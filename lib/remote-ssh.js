'use babel';

import { CompositeDisposable } from 'atom';
import stripJsonComments from 'strip-json-comments';
import { EventEmitter } from 'events';
import Path from 'path';
const { exec } = require('child_process');
const fs = require('fs-plus');

export default {
	subscriptions: null,

	activate() {
		this.subscriptions = new CompositeDisposable();
		this.subscriptions.add(atom.commands.add('atom-workspace', {
			'remote-ssh:start': () => this.start()
		}));
	},

	deactivate() {
		this.subscriptions.dispose();
	},

	start() {
		let filePath = this.getFilePath('./.ftpconfig');
		if (filePath != null) {
			if (fs.existsSync(filePath)) {
				fs.readFile(filePath, 'utf8', (err, res) => {
					if (err) { return error(err); }

					const data = stripJsonComments(res);
					let json;
					try {
						json = JSON.parse(data);
					} catch (e) {
						atom.notifications.addError('Remote SSH: Error loading .ftpconfig',
						{ dismissible: true, detail: e });
						return;
					}
					let args;
					if (typeof(json.session) !== "undefined") {
						args = [
							"-ssh",
							"-2",
							"-load", '"' + json.session + '"',
							"-pw", '"' + json.pass + '"'
						];
					} else {
						args = [
							"-ssh",
							"-2",
							"-pw", '"' + json.pass + '"',
							"-l", '"' + json.user + '"',
							"-P", '"' + json.port + '"',
							json.host
						];
					}
					atom.notifications.addInfo('Remote SSH: Starting Putty', { dismissible: true });
					let event = exec('putty ' + args.join(' '));
					//if (event.exitCode != 0) { }
				});
			} else {
				atom.notifications.addError('Remote SSH: Could not start SSH connection', {
					dismissible: true, detail: `You need an ftpconfig file with the nessecary credentials`,
				});
			}
		}
	},

	getFilePath(relativePath) {
		const self = this;
		const projectPath = self.getProjectPath();
		if (projectPath === false) return false;
		return Path.resolve(projectPath, relativePath);
	},

	getProjectPath() {
		const self = this;
		let projectPath = null;

		const firstDirectory = atom.project.getDirectories()[0];
		if (firstDirectory != null) projectPath = firstDirectory.path;

		if (projectPath != null) {
			self.projectPath = projectPath;
			return projectPath;
		}
		atom.notifications.addError('Remote SSH: Could not load project path', {
			dismissible: true,
		});
		return false;
	},

	getConfigPath() {
		return this.getFilePath('./.ftpconfig');
	}
};
