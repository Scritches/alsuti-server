# alsuti-server
The alsuti server component

## Setup

**1)** First make sure that *redis* is installed and running. It is highly recommended to enable AOF (append only) and make daily/weekly backups to ensure data does not get lost.

**2)** *cd* into the alsuti-server directory and run the following command with '*USER*' and '*PASSWORD*' replaced to your liking. It will automatically generate metadata for any existing uploads from previous versions.

~~~~
./admin mkdb admin=USER password=PASSWORD
~~~~

You may also append '*public*' to this command to make any existing uploads public instead of private (default).

## Running Alsuti:

**Note:** It is recommended to use a *tmux/screen* session on your server so you can easily start/stop alsuti via *ssh*.

Finally, simply run:

~~~~
./bin/www
~~~~

Enjoy. :)
