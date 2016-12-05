# alsuti-server
The alsuti server component

## Setup

**1)** Set the following environment variables:

####ALSUTI_INSTANCE
The external url to your server without a trailing slash. *Required.*

####ALSUTI_DATABASE
The redis database to use. *Optional, but recommended*.

Make sure you set this correctly if you have other databases or else they will likely get clobbered.

####ALSUTI_TLS
When set to 'yes' the key and cert variables explained below are used to configure TLS. *Optional.*

This isn't needed if your server is configured to proxy subdomain requests to alsuti via localhost. If not, keep in mind that plain HTTP is **inherently insecure**.

####ALSUTI_TLS_KEY
TLS key. *Optional.*

####ALSUTI_TLS_CERT
TLS certificate. *Optional.*

**2)** Make sure redis-server is running

**3)** cd into the alsuti-server directory and issue this command with 'USER' and 'PASSWORD' replaced respectively:

~~~~
./admin mkdb user=USER password=PASSWORD
~~~~

You may also append 'public' to this command to make all existing uploads publicly listed, as any uploads are private by default.

**4)** Start Alsuti:

~~~~
./bin/www
~~~~

**5)** Enjoy the awesomeness. :)
