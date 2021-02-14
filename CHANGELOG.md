## 0.12.0 - Bugfix and refactoring Release
* New notifications here and there instead of silent `console.error`s that no one sees
* Scanning project folder on startup is only done if enabled in settings and if global project folder setting is non-empty, instead of failing silently
* Enabling project folder starts scanning immediately only if the global project folder is non-empty as well (ie. was set beforehand), otherwise you need to trigger scanning after setting the project folders via `CTRL+ALT+D` manually
* Fixed an issue where a project folder like `C:/AtomProjects/superproject/subproject` itself wasn't included in the scanning, only its subfolders, contradicting the description in the README
* [https://github.com/dsone/remote-ssh/issues/9](#9) Fixed issue with SSH keys inside PUTTY, when `pass` inside .ftpconfig was rightfully not set
* [https://github.com/dsone/remote-ssh/issues/9](#4) Similar to #9 but for non-Win32 platforms when password isn't set

## 0.11.0 - Feature Release
* Rearranged options, forcing a specific order in settings view
* Added new (opt-in) command to scan ftpconfig files and a search function, available via CTRL+ALT+S and CTRL+ALT+D
* Added two new entries in ftpconfig rs_name and rs_tags for the search function to name and tag SSH connections
* Added ability to configure search result formatting

## 0.10.0 - Feature Release
* Options added, enabling default ssh client, adds Mac and Linux support
* Option added for copying the password to the clipboard

## 0.8.2 - Bugfix Release
* Added more error handling to catch an odd issue with fs-plus.js or a similar node_module writing/reading the config file.

## 0.8.1 - Bugfix Release
* Removed leftover config test, leading to loading issues

## 0.8.0 - Bugfix Release
* Fixed an issue with an empty session variable in .ftpconfig, preventing Putty from connecting to the server as intended by the user

## 0.7.0 - Third Release
* Added new option to create a new .ftpconfig / overwrite the old one
* Added a message for Non-Windows OSes that remote-ssh currently does not support those

## 0.6.0 - Second Release
* Additional error handling
* Added a new keyword

## 0.1.0 - First Release
* Every feature added
* Every bug ~fixed~ introduced
