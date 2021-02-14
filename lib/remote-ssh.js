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
		if (typeof(this.settings.globalProjectFolder) !== 'undefined' && this.settings.globalProjectFolder.length > 0) {
			this.scanProjectFolder()
				.then((items) => this.resolveScanning(items))
				.catch((e) => this.rejectScanning(e))
		}
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
		this.showNotification('Remote SSH: Scanning projects', { detail: error }, 'error');
		this.scanning = false;
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
		Object.keys(_sets).map(e => {
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
			if (_b && !_this.scanning && typeof(_this.settings.globalProjectFolder) !== 'undefined' && _this.settings.globalProjectFolder.length > 0) {
				_this.scanProjectFolder()
					 .then((items) => _this.resolveScanning(items))
					 .catch((e) => _this.rejectScanning(e));
			}
		});
		atom.config.observe('Remote-SSH.40_globalProjectFolder', function(_s) {
			if (_this.delayTimer) { _this.delayTimer = clearTimeout(_this.delayTimer); }
			_this.settings.globalProjectFolder = _s;
			_this.delayTimer = setTimeout( () => {
				if (_this.settings.scanConfig && !_this.scanning) {
					_this.scanProjectFolder()
						 .then((items) => _this.resolveScanning(items))
						 .catch((e) => _this.rejectScanning(e));
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
				return reject('Scanning aborted, project folder not set in settings');
			}

			this.scanning = true;
			let _si = [];	// temp var for items
			let startPaths = this.settings.globalProjectFolder.split(',');
			startPaths.map(filePath => {
				try {
					filePath = filePath.trim();
					if (fs.existsSync(filePath)) {
						var files = fs.readdirSync(filePath);
						files.unshift('./');  // to include "C:/AtomProjects/superproject/subproject" itself in the lookup, too
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
										projectName: json.rs_name || json.host,
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

	/**
	 * Displays a notification on screen.
	 *
	 * @param	string	title		The title of the notification to display
	 * @param	json	options		Options literal
	 * @param	string	notifyType	The type of notification, optional, default is `info`, supports `error|fatalError|info|success|warning`
	 * @return	void
	 */
	showNotification(title, options = {}, notifyType = 'info') {
		try {
			let type = `add${ notifyType.charAt(0).toUpperCase() }${ notifyType.slice(1) }`;
			if (typeof(atom.notifications[type]) !== 'undefined') {
				atom.notifications[type](title, options);
			} else {
				atom.notifications.addWarning(title, { dismissible: true, ...options });
			}
		} catch (e) {
			console.error(e);
			atom.notifications.addWarning(title, { dismissible: true });
		}
	},

	/**
	 * Shorthand function for getting values from JSON literals with fallacks for undefined values.
	 *
	 * @param	json	json					The json to look for a key in to return
	 * @param	string	withKey					A key inside json to return
	 * @param	string	withDefaultValue		Optional default value to return if withKey is undefined, if not set undefined is used
	 * @param	bool	whileEmptyStringAllowed	Optional setting to allow empty strings, default is allowed (true)
	 * @return	mixed							Any kind of datatype inside json
	 */
	getValueFrom(json, withKey, withDefaultValue = undefined, whileEmptyStringAllowed = true) {
		let type = typeof(json[withKey]);
		if (type !== 'undefined') {
			if (type === 'string') {
				if (type.length === 0 && !whileEmptyStringAllowed) {
					return withDefaultValue;
				}
			}
			return json[withKey];
		}
		return withDefaultValue;
	},

	startSSH(file, name) {
		let filePath = this.getFilePath((file || './.ftpconfig'));
		if (filePath != null) {
			if (existsSync(filePath)) {
				readFile(filePath, 'utf8', (err, res) => {
					if (err) { return err; }

					const data = stripJsonComments(res);
					let json;
					try {
						json = JSON.parse(data);
					} catch (e) {
						this.showNotification('Remote SSH: Error loading .ftpconfig', { detail: e }, 'error');
						return;
					}

					let notificationTitle = "Remote SSH: Starting SSH client";
					let notificationDetail = "";
					if (name) {
						notificationDetail = name;
					} else {
						notificationDetail = this.getValueFrom(
							json, 'rs_name',
							this.getValueFrom(
								json, 'host', 'Undefined host', false
							),
							false
						);
					}

					let jsonUser = this.getValueFrom(json, 'user');
					let jsonHost = this.getValueFrom(json, 'host');
					if (!jsonUser || !jsonHost) {
						this.showNotification(notificationTitle, { detail: 'User or hostname not set, cannot start' }, 'error');
						return;
					}
					let jsonPassword = this.getValueFrom(json, 'pass', '');

					this.showNotification(notificationTitle, { detail: notificationDetail });

					if (!process.platform == "win32" || this.settings.useSSH) {
						try {
							spawn('ssh', [ `${ jsonUser }@${ jsonHost }` ], { detached: true, shell: true });
							atom.clipboard.write(jsonPassword);
						} catch (e) {
							this.showNotification(notificationTitle, { detail: e }, 'error');
						}

						return;
					}

					let proc = [
						'putty',
						'-ssh',
						'-2'
					];
					if (typeof(json.pass) !== 'undefined') {
						if (this.settings.copyPassword) {
							atom.clipboard.write(jsonPassword);
						} else {
							proc.push(`-pw "${ jsonPassword }"`);
						}
					}

					let jsonSession = this.getValueFrom(json, 'session', undefined, false);
					// Using saved session inside Putty - might include SSH key usage
					if (jsonSession) {
						proc.push(`-load "${ jsonSession }"`);
					// manually building putty connection
					} else {
						let jsonPort = this.getValueFrom(json, 'port', 22);

						proc.push(`-l "${ jsonUser }"`);
						proc.push(`-P "${ jsonPort }"`);
						proc.push(jsonHost);
					}

					try {
						exec(proc.join(' '));
					} catch (e) {
						this.showNotification(notificationTitle, { detail: e }, 'error');
					}
				});
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
						this.showNotification('Remote SSH: Writing config file failed', {}, 'error');
					}
				});
			}
		} catch (e) {
			this.showNotification("Remote SSH: Couldn't write config file", { detail: e }, 'warning');
		}
	},

	getFilePath(relativePath) {
		try {
			const self = this;
			const projectPath = self.getProjectPath();
			if (projectPath === false) { return false; }
			return Path.resolve(projectPath, relativePath);
		} catch (e) {
			this.showNotification('Remote SSH: getFilePath failed', { detail: e }, 'error');

			return null;
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

			this.showNotification("Remote SSH: Could not load project path", {}, 'error');
			return false;
		} catch (e) {
			this.showNotification("Remote SSH: Couldn't get project Path", { detail: e }, 'error');

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
				this.showNotification('Remote SSH', { detail: 'To use this feature you need to enable the project folder scan setting' }, 'info');
				return;
			}
			if (this.settings.globalProjectFolder.length === 0) {
				this.showNotification('Remote SSH', { detail: 'You need to set your global project folder to use this' }, 'info');
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
