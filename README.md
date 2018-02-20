# STEEM Witness Failover incl. SMS-Alerts via NEXMO

This script has three main tasks:

- Watch for Missed Blocks
- Switch to Backup-Node(s) and / or disable the witness
- Alert the Witness via SMS of missed blocks

### IMPORTANT

I want to mention that the script has not yet been tested in the case of a real missed-block. Theoretically, everything should work. 
But - I've also implented a testmode - which only notifies you via console.log and doesn't interact with the blockchain or SMS, just as a way to test the reaction.

I hope to get some insights about what works and what doesn't with this release - but: I don't take any responsibility if the script doesn't behave as expected.

# Installation & Setup

The Witness-Failover script was written in pure ES6 JS and thus needs babel to compile. In addition it uses dsteem as RPC-Client library.

Make sure you have installed npm & node.

1.) Clone the repository & go into the folder

```
git clone https://github.com/therealwolf42/witness-failover.git
cd witness-failover
```
2.) Install dependencies

```
npm i
```
3.) Copy config.example.json and edit config.json

```
cp config.example.json config.json
```

The `INTERVAL` - how often it should check for missed blocks - is in minutes. And this depends on how often you produce a block. I'm in the top 50 and produce one block roughly every hour. That's why I used 20 minutes. But for a TOP 20 Witness, this number has to be a lot lower.

```
{
  "TEST_MODE": "DISABLED",
  "RPC_NODES": [
    "https://api.steemit.com",
    "https://steemd.privex.io",
    "https://gtg.steem.house:8090",
    "https://rpc.buildteam.io",
    "https://steemd.minnowsupportproject.org"
  ],
  "WITNESS": "",
  "BACKUP_KEYS": [
    ""
   ],
  "MISSED_BLOCKS_THRESHOLD":2,
  "INTERVAL":20,
  "USE_SMS_ALERT":"ENABLED",
  "SEND_AFTER_EVERY_MISSED":"ENABLED"
}
```

4.) Create an .env file (`touch .env`) with the following variables and paste in your own (!)

```
ACTIVE_KEY=
NEXMO_API_KEY=
NEXMO_API_SECRET=
PHONE_NUMBER=
```

Make sure that you include your country-code in your phone_number - e.g. `49123456789` (+49 would be Germany)

After all this - you should have the 2 marked files in your folder:

https://steemitimages.com/0x0/https://steemitimages.com/DQmR1uvTKKKHqQT91voZFUQHurtHGWsPQD7RUqfScPEaBbz/image.png

# NEXMO?

NEXMO is a provider similar to TWILIO & co. but I personally find it a bit cheaper to use. In the future I will modify the script to use another alternative - but for now this should be enough.

You can create an account here: https://www.nexmo.com/

# Starting

There are currently 3 available script-commands.

1.) Start Witness-Failover

This command will start the script for you.

```
npm start
```

2.) Testing SMS

To make sure that you entered a valid phone-number, you can test it by running the command below:
(this SMS will cost you a few cents)

```
npm run test_sms
```

3.) Building /dist folder from source

This happens automatically if you use npm start - however you might want to run node dist/index.js yourself - in that case you can build it yourself.

```
npm run build
```

# Running in the background

I personally use either tmux or pm2 to run scripts in the background - but in this case I'll stick with pm2.

```
npm install pm2 -g
pm2 start npm --name "failover" -- start
pm2 logs failover
```

## Questions or Feedback?

Contact me on steemit.chat @therealwolf or on discord therealwolf#5970

