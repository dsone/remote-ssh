'use babel';

import { CompositeDisposable } from 'atom';
import stripJsonComments from 'strip-json-comments';
import Path from 'path';
import { spawn } from 'child_process';
import { exec } from 'child_process';
import { existsSync, readFile, writeFile, readFileSync } from 'fs-plus';
import RemoteSshSearchView from './remote-ssh-search-view';
import * as fs from 'fs';

const RemoteSSH = {
	subscriptions: null,
	settings: {},
	searchItems: null,
	searchView: null,
	searchModal: null,
	scanning: true,	// delays scanning on startup automagically

	activate(state) {
		console.log("Activating remote-ssh");

		// Create SearchView
		this.searchView = new RemoteSshSearchView(this, this.settings.search_primary);
		this.searchModal = atom.workspace.addModalPanel({
			item: this.searchView.getElement(),
			visible: false
		});

		// Handle settings and set observers
		this.setupSettings();

		// Add any subs to watch for
		this.subscriptions = new CompositeDisposable();
		this.subscriptions.add(atom.commands.add('atom-workspace', {
			'remote-ssh:start': () => this.startSSH(),
			'remote-ssh:create-config': () => this.createConfigFile(),
			'remote-ssh:toggle-search': () => this.toggleSearch(),
			'remote-ssh:rescan-projects': () => this.scanProjectFolder().then((items) => this.resolveScanning(items)).catch((e) => this.rejectScanning(e))
		}));

		this.scanning = false;
		this.scanProjectFolder()
			.then((items) => this.resolveScanning(items))
			.catch((e) => this.rejectScanning(e))
	},

	resolveScanning(items) {
		this.searchItems = items.slice(0);
		this.searchView.setItems(this.searchItems);

		// when Atom starts and resolves, setting scanning=false will set it in this RemoteSSH object correctly to false
		// but for some reason Atom still thinks it's true and hitting shortcut to exec new scan results in reject
		// not with setTimeout tho
		setTimeout(() => {
			this.scanning = false;
		}, 0);
		console.timeEnd('Remote SSH - Project scanning');
	},
	rejectScanning(error) {
		this.scanning = false;
		console.error(error);
		console.timeEnd('Remote SSH - Project scanning');
	},

	setupSettings() {
		let _this = this;

		// transfer renamed options
		if (atom.config.get('Remote-SSH.useSSH')) {
			atom.config.set('Remote-SSH.10_useSSH', atom.config.get('Remote-SSH.useSSH'));
			atom.config.unset('Remote-SSH.useSSH');
		}
		if (atom.config.get('Remote-SSH.copyPassword')) {
			atom.config.set('Remote-SSH.20_copyPassword', atom.config.get('Remote-SSH.copyPassword'));
			atom.config.unset('Remote-SSH.copyPassword');
		}

		// Let's load and map available config, to force sorting they have a leading \d_
		let _sets = atom.config.get('Remote-SSH');
		Object.keys(_sets).map( (e) => {
			_this.settings[ e.replace(/^\d+?_/, '') ] = _sets[e];
		});

		// Start observing changes
		atom.config.observe('Remote-SSH.10_useSSH', function(_b) {
			let e = document.getElementById('Remote-SSH.20_copyPassword');
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
			_this.settings.useSSH = _b;
		});
		atom.config.observe('Remote-SSH.20_copyPassword', function(_b) {
			_this.settings.copyPassword = _b;
		});

		// Scanning folders
		_this.delayTimer = undefined;
		atom.config.observe('Remote-SSH.30_scanConfig', function(_b) {
			_this.settings.scanConfig = _b;
			if (_b && !_this.scanning) {
				RemoteSSH.scanProjectFolder.call(_this);
			}
		});
		atom.config.observe('Remote-SSH.40_globalProjectFolder', function(_s) {
			if (_this.delayTimer) { _this.delayTimer = clearTimeout(_this.delayTimer); }
			_this.settings.globalProjectFolder = _s;
			_this.delayTimer = setTimeout( () => {
				if (_this.settings.scanConfig && !_this.scanning) {
					RemoteSSH.scanProjectFolder.call(_this);
				}
			}, 500);
		});

		_this.delayTimerSP = undefined;
		atom.config.observe('Remote-SSH.50_searchPrimary', function(_s) {
			if (_this.delayTimerSP) { _this.delayTimerSP = clearTimeout(_this.delayTimerSP); }
			_this.settings.searchPrimary = _s;
			_this.delayTimerSP = setTimeout( () => {
				_this.searchView.setPrimLine(_s);
			}, 500);
		});
	},

	scanProjectFolder() {
		console.time('Remote SSH - Project scanning');
		return new Promise((resolve, reject) => {
			if (this.scanning) { return reject('Scanning already in progress'); }
			else if (typeof(this.settings.globalProjectFolder) === 'undefined' || this.settings.globalProjectFolder.length === 0) {
				this.scanning = false;
				return reject('Scanning aborted, project folder invalid');
			}
			this.scanning = true;
			let _si = [];	// temp var for items
			let startPaths = this.settings.globalProjectFolder.split(',');
			startPaths.map((filePath) => {
				try {
					filePath = filePath.trim();
					if (fs.existsSync(filePath)) {
						var files = fs.readdirSync(filePath);
						for (let i = 0 ; i < files.length; ++i) {
							var filename = Path.resolve(filePath, files[i]);
							var stat = fs.lstatSync(filename);
							if (stat.isDirectory()) {
								let configPath = Path.resolve(filePath, files[i], '.ftpconfig');
								if (existsSync(configPath)) {
									var content = readFileSync(configPath, { encoding: 'utf8', flag: 'r' });
									const data = stripJsonComments(content);
									let json;
									try {
										json = JSON.parse(data);
									} catch (e) {
										return;
									}

									let item = {
										projectName: json.rs_name,
										folderName: files[i],
										host: json.host || undefined,
										tags: [],
										config: configPath,
										search: (typeof(json.rs_name) === 'string' && json.rs_name.length > 0 ? json.rs_name + ', ' : '') + files[i] + (typeof(json.host) === 'string' && json.host.length > 0 ? json.host + ', ' : '')
									};

									if (Array.isArray(json.rs_tags)) {
										json.rs_tags.map( (e) => {
											if (typeof(e) === 'string' && e.length > 0) {
												item.tags.push(e);
											}
										});
										item.tags.sort();
									}

									item.search += ', ' + item.tags.join(', ') + (typeof(json.host) === 'string' && json.host.length > 0 ? ', ' + json.host : '');
									_si.push(item);
								}
							}
						}
					}
				} catch (e) {
					return reject(e);
				}
			});
			return resolve(_si.slice(0));
		});
	},

	deactivate() {
		this.subscriptions.dispose();
		this.searchView.destroy();
		this.searchModal.destroy();
	},

	startSSH(file, name) {
		let filePath = this.getFilePath((file || './.ftpconfig'));
		if (filePath != null) {
			try {
				if (existsSync(filePath)) {
					readFile(filePath, 'utf8', (err, res) => {
						if (err) { return err; }

						const data = stripJsonComments(res);
						let json;
						try {
							json = JSON.parse(data);
						} catch (e) {
							atom.notifications.addError('Remote SSH: Error loading .ftpconfig',
							{ dismissible: true, detail: e });
							return;
						}

						let n_str = "Remote SSH: Starting SSH client";
						let detail = "";
						if (name) {
							detail = name;
						} else {
							if (typeof(json.rs_name) === 'string' && json.rs_name.length > 0) {
								detail = json.rs_name;
							} else {
								detail = json.host;
							}
						}
						if (process.platform == "win32") {
							if (this.settings.useSSH) {
								atom.notifications.addInfo(n_str, { dismissible: true, detail: detail });
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

								if (this.settings.copyPassword) {
									atom.clipboard.write(json.pass);
								} else {
									proc.push("-pw");
									proc.push('"' + json.pass + '"');
								}
							} else {
								if (this.settings.copyPassword) {
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
							atom.notifications.addInfo(n_str, { dismissible: true, detail: detail });
							exec(proc.join(' '));
						} else {
							atom.notifications.addInfo(n_str, { dismissible: true, detail: detail });
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
			"session": "",
			"rs_name": "",
			"rs_tags": []
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
	},

	serialize () {
		return {
			viewState: this.searchView.serialize()
		};
	},

	toggleSearch(forceHide) {
		if (forceHide || this.searchModal.isVisible()) {
			this.searchModal.hide();
		} else {

			if (!this.settings.scanConfig) {
				atom.notifications.addInfo('Remote SSH: To use this feature you need to enable the project folder scan setting', { dismissible: true });
				return;
			} else if (this.settings.globalProjectFolder.length === 0) {
				atom.notifications.addInfo('Remote SSH: You need to set your global project folder to use this', { dismissible: true });
				return;
			}

			this.searchModal.show();
			this.searchView.setItems(this.searchItems);
			// delay focus of input or opening the modal with ctrl + shift + p will propagate enter to the input
			setTimeout(() => this.searchView.selectList.focusFilterEditor(), 100);
		}
		return true;
	},
};

export default RemoteSSH;
