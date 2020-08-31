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

async function exec() {
	try {
		const repoToken = core.getInput('repo-token');
		const octokit = github.getOctokit(repoToken);

		const argv = parseArgs();
		const {
			pull_request: { commits_url },
		} = githubEvent;
		const { data: commits } = await octokit.request(commits_url);

		console.log(`commits`, JSON.stringify(commits, null, 2));
		const result = await new Action({
			githubEvent: { commits: commits.map(({ commit }) => commit) },
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

		console.log('No issueKeys found.');
		core.setFailed('No issueKeys found.');
	} catch (error) {
		core.setFailed(error.toString());
	}
}

function parseArgs() {
	return {
		event: core.getInput('event') || config.event,
		string: core.getInput('string') || config.string,
		from: core.getInput('from'),
	};
}

exec();
