const fs = require('fs');
const YAML = require('yaml');
const core = require('@actions/core');

const cliConfigPath = `${process.env.HOME}/.jira.d/config.yml`;
const configPath = `${process.env.HOME}/jira/config.yml`;
const Action = require('./action');

// eslint-disable-next-line import/no-dynamic-require
const githubEvent = require(process.env.GITHUB_EVENT_PATH);
const config = YAML.parse(fs.readFileSync(configPath, 'utf8'));
const github = require('@actions/github');

const allowedCommits = /^Merge branch/;

async function exec() {
	try {
		const argv = parseArgs();
		const { repoToken, allowList } = argv;
		const octokit = github.getOctokit(repoToken);
		const allowMap = allowList
			.split(',')
			.reduce((obj, key) => ({ [key]: true, ...obj }), {});

		const {
			pull_request: { commits_url },
		} = githubEvent;
		const { data: commits } = await octokit.request(commits_url);
		const treatedCommits = commits
			.filter(
				({ commit: { email, message } }) =>
					!allowMap[email] && !allowedCommits.test(message)
			)
			.map(({ commit }) => commit);
		console.log(`allowList`, allowList.split(','));
		console.log(`commits`, JSON.stringify(treatedCommits, null, 2));
		const result = await new Action({
			githubEvent: { commits: treatedCommits },
			argv,
			config,
		}).execute();
		if (result) {
			console.log(`Detected issues: ${JSON.stringify(result, null, 2)}`);
			// console.log(`Saving ${result.issue} to ${cliConfigPath}`);
			// console.log(`Saving ${result.issue} to ${configPath}`);

			// Expose created issue's key as an output
			core.setOutput('issues', result);

			const yamledResult = YAML.stringify(result);
			const extendedConfig = Object.assign({}, config, result);

			fs.writeFileSync(configPath, YAML.stringify(extendedConfig));

			return fs.appendFileSync(cliConfigPath, yamledResult);
		}

		console.log('Could no find an issue key on all commits.');
		core.setFailed('Could no find an issue key on all commits.');
	} catch (error) {
		core.setFailed(error.toString());
	}
}

function parseArgs() {
	return {
		event: core.getInput('event') || config.event,
		string: core.getInput('string') || config.string,
		from: core.getInput('from'),
		repoToken: core.getInput('repo-token'),
		allowList: core.getInput('allowlist') || '',
	};
}

exec();
