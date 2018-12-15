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
