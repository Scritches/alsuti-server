# alsuti-server
The alsuti server component

## Setup

**1)** First make sure that *redis* is installed and running. It is highly recommended to enable AOF (append only) and make daily/weekly backups to ensure data does not get lost.

**2)** *cd* into the alsuti-server directory and run the following command with '**USER**' and '**PASSWORD**' replaced to your liking. It will also automatically generate metadata for any existing uploads from previous versions. You may also append the '**public**' parameter to make existing uploads public instead of private (default).

~~~~
./admin mkdb admin=USER password=PASSWORD
~~~~

## Running Alsuti:

**Note:** It is recommended to use a *tmux/screen* session on your server so you can easily start/stop alsuti via *ssh*.

Finally, simply run:

~~~~
./bin/www
~~~~

Enjoy. :)
