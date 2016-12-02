# alsuti-server
The alsuti server component

## Setup

Make sure redis is running and set the following environment variables:

####ALSUTI_INSTANCE
The external url (without a trailing /) to your server. *Required.*

####ALSUTI_DATABASE
The redis database to use. *Optional, but recommended*.

####ALSUTI_TLS_ENABLED
When set to 'yes' the KEY and CERT variables below are used to configure TLS support. *Optional.*

####ALSUTI_TLS_KEY
TLS key. *Optional.*

####ALSUTI_TLS_CERT
TLS certificate. *Optional.*
