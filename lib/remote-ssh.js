'use babel';

import { CompositeDisposable } from 'atom';
import stripJsonComments from 'strip-json-comments';
import Path from 'path';
import { spawn } from 'child_process';
import { exec } from 'child_process';
import { existsSync, readFile, writeFile } from 'fs-plus';

const RemoteSSH =  {
	subscriptions: null,
	settings: null,

	activate() {
		console.log("Activating remote-ssh");

		settings = atom.config.get('Remote-SSH');
		atom.config.observe('Remote-SSH.useSSH', function(_b) {
			let e = document.getElementById('Remote-SSH.copyPassword');
			if (e !== null) {
				if (_b) {
					if (!e.checked) { e.click(); }
					e.setAttribute('disabled', 'disabled');
					e.parentNode.parentNode.style.opacity = 0.5;
				} else {
					e.removeAttribute('disabled');
					if (e.checked) { e.click(); }
					e.parentNode.parentNode.style.opacity = 1;
				}
			}
			settings.useSSH = _b;
		});
		atom.config.observe('Remote-SSH.copyPassword', function(_b) {
			settings.copyPassword = _b;
		});

		this.subscriptions = new CompositeDisposable();
		this.subscriptions.add(atom.commands.add('atom-workspace', {
			'remote-ssh:start': () => this.start(),
			'remote-ssh:create-config': () => this.createConfigFile()
		}));
	},

	deactivate() {
		this.subscriptions.dispose();
	},

	start() {
		let filePath = this.getFilePath('./.ftpconfig');
		if (filePath != null) {
			try {
				if (existsSync(filePath)) {
					readFile(filePath, 'utf8', (err, res) => {
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

						if (process.platform == "win32") {
							if (settings.useSSH) {
								atom.notifications.addInfo('Remote SSH: Starting SSH client', { dismissible: true });
								spawn('ssh', [ json.user + '@' + json.host ], { detached: true, shell: true });
								atom.clipboard.write(json.pass);
								return;
							}
							let proc = [
								'putty',
								'-ssh',
								'-2'
							];
							if (typeof(json.session) !== "undefined" && json.session.length > 0) {
								proc.push("-load");
								proc.push('"' + json.session + '"');

								if (settings.copyPassword) {
									atom.clipboard.write(json.pass);
								} else {
									proc.push("-pw");
									proc.push('"' + json.pass + '"');
								}
							} else {
								if (settings.copyPassword) {
									atom.clipboard.write(json.pass);
								} else {
									proc.push("-pw");
									proc.push('"' + json.pass + '"');
								}
								proc.push("-l");
								proc.push('"' + json.user + '"');
								proc.push("-P");
								proc.push('"' + json.port + '"');
								proc.push(json.host);
							}
							atom.notifications.addInfo('Remote SSH: Starting Putty', { dismissible: true });
							exec(proc.join(' '));
						} else {
							atom.notifications.addInfo('Remote SSH: Starting SSH client', { dismissible: true });
							spawn('ssh', [ json.user + '@' + json.host ], { detached: true, shell: true });
							atom.clipboard.write(json.pass);
						}
					});
				}
			} catch (e) {
				atom.notifications.addWarning("Remote SSH: Couldn't connect", { dismissible: true, detail: e });
			}
		}
	},

	createConfigFile() {
		let defData = {
			"protocol": "",
			"host": "",
			"port": "",
			"user": "",
			"pass": "",
			"promptForPass": false,
			"remote": "/",
			"local": "",
			"agent": "",
			"privatekey": "",
			"passphrase": "",
			"hosthash": "",
			"ignorehost": true,
			"connTimeout": 10000,
			"keepalive": 10000,
			"keyboardInteractive": false,
			"remoteCommand": "",
			"remoteShell": "",
			"watch": [],
			"watchTimeout": 500,
			"session": ""
		};
		try {
			let configPath = this.getConfigPath();
			if (configPath.length == 0) { return; }
			let fileAlreadyExists = existsSync(configPath);

			let write = true;
			if (fileAlreadyExists) {
				write = atom.confirm({
					message: 'Do you want to overwrite .ftpconfig?',
					detailedMessage: `A config already exists in ${configPath}`,
					buttons: {
						Yes: () => true,
						No: () => false,
					},
				});
			}

			if (write) {
				let json = JSON.stringify(defData, null, 4);
				writeFile(configPath, json, (err) => {
					if (!err) {
						atom.workspace.open(configPath);
					} else  {
						atom.notifications.addError("Remote SSH: Writing config file failed", { dismissible: true });
					}
				});
			}
		} catch (e) {
			atom.notifications.addWarning("Remote SSH: Couldn't write config file", { dismissible: true, detail: e });
		}
	},

	getFilePath(relativePath) {
		try {
			const self = this;
			const projectPath = self.getProjectPath();
			if (projectPath === false) { return false; }
			return Path.resolve(projectPath, relativePath);
		} catch (e) {
			atom.notifications.addError("Remote SSH: getFilePath failed", { dismissible: true, detail: e });
			return "";
		}
	},

	getProjectPath() {
		try {
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
		} catch (e) {
			atom.notifications.addError("Remote SSH: Couldn't get project Path", { dismissible: true, detail: e });
			return false;
		}
	},

	getConfigPath() {
		return this.getFilePath('./.ftpconfig');
	}
};

export default RemoteSSH;
