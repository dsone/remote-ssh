# remote-ssh package

### Introduction
Remote SSH is a little helper tool originally for Windows to quickly start Putty and connect to a potential server you are currently working on.
While the default SSH client is Putty, Remote SSH supports the default SSH client of Linux and Mac, or any other ssh client called ssh that is globally accessible, too.

### Using Remote SSH
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

### Putty specific:
The session option was added in case you have saved sessions inside your Putty and you want to re-use those. Just enter the name of your saved session.
For Remote SSH to work with Putty, it should be in a global (environment) path, making it accessible from everywhere.
  
### Alternative SSH clients
To work with any other ssh client that ssh client must be named "ssh" and in your environment path.

### Shortcuts
Default Shortcut is `CTRL+ALT+R` to start a new SSH connection.  
`CTRL+ALT+F` to create a new config file.
