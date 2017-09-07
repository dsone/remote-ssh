# remote-ssh package

Remote SSH is a little helper tool to quickly start Putty and connect to a potential server you are currently working on.
For Remote SSH to work you need a .ftpconfig file in your project folder in the format of _at least_
```
{
    "protocol": "sftp",
    "host": "",
    "port": 22,
    "user": "user",
    "pass": "pass",
	"session": ""
}
```

Wheras SFTP is default for Remote SSH.
The session option was added in case you have saved sessions in Putty and you want to re-use those. Just enter the name of your saved session.

For Remote SSH to work it should be in a global (environment) path, making it accessible from everywhere.

Default Shortcut is `CTRL+ALT+R`.
