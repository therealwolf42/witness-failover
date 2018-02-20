const fs = require('fs')
const request = require('superagent')
const dotenv = require('dotenv').config()

const steem = require('steem')
const dsteem = require('dsteem')

let config = JSON.parse(fs.readFileSync('config.json'))
const NULL_KEY = 'STM1111111111111111111111111111111114T1Anm'
const RPC_NODES = config.RPC_NODES

let rpc_node = config.RPC_NODES ? config.RPC_NODES[0] : 'https://api.steemit.com'
let current_backup_key = ''
let client = new dsteem.Client(rpc_node, {timeout: 8 * 1000})

let start_total_missed = 99999
let current_total_missed = 99999
let props = {}
let witness_url = ''

let count = 0

let start = async () => {
  try {
    while(true) {
      if(start_total_missed === 99999) {
        console.log('\n'+'----------------------------'+'\n')
        console.log('Initiating Witness-Failover')
        await check_missing_variables()
        let res = await get_witness_by_account()
        if(res) {
          start_total_missed = res.total_missed
          current_total_missed = start_total_missed
          witness_url = res.url
          props = res.props
          console.log(`Watching Witness Account: ${config.WITNESS} for missed blocks - current total missed blocks: ${start_total_missed}`)
          console.log(`Allowed missed blocks until failover: ${config.MISSED_BLOCKS_THRESHOLD}`)
          console.log(`Backup Keys: ${config.BACKUP_KEYS}`)
          if(config.TEST_MODE ===  enums.ENABLED) console.log('TEST MODE ENABLED')
        }
      }

      let witness = await get_witness_by_account()
      if(witness.total_missed > current_total_missed) {
        console.log('[ DANGER ] Missed a Block!')
        
        let missed_since_start = witness.total_missed - start_total_missed
        if(missed_since_start >= Number(config.MISSED_BLOCKS_THRESHOLD)) {
  
          let key = NULL_KEY
          if(current_backup_key) {   
            let index = config.BACKUP_KEYS.indexOf(current_backup_key)
            if(index < config.BACKUP_KEYS.length && index > -1) key = current_backup_key = config.BACKUP_KEYS[index + 1]
          }
  
          let update_result = await update_witness(key)
          start_total_missed = current_total_missed = witness.total_missed
  
          if(config.USE_SMS_ALERT === enums.ENABLED) {
            let result = await send_sms(`Your Witness missed 1 Block! Only ${missed_since_start} more until failover.`)
          }
  
          if(key === NULL_KEY) {
            console.log('Exiting now due to disabled Witness')
            process.exit(-1)
          }
  
        } else {
          current_total_missed = witness.total_missed
          if(config.USE_SMS_ALERT === enums.ENABLED && config.SEND_AFTER_EVERY_MISSED === enums.ENABLED) {
            console.log('SMS Sending activated - SENDING SMS NOW!')
            let result = await send_sms(`Your Witness missed 1 Block! Only ${missed_since_start} more until failover.`)
          }
        }
      }
      await timeout(config.INTERVAL * 60)
    }
  } catch (e) {
    console.error('start', e)
    start()
  }
}

let check_missing_variables = async () => {
  try {
    console.log('Checking for missing .env & config variables')
    let env_missing = []
    let config_missing = []

    if(!config.RPC_NODES || config.RPC_NODES.length <= 0) config_missing.push('RPC_NODES')
    if(!config.WITNESS) config_missing.push('WITNESS')
    if(!process.env.ACTIVE_KEY) env_missing.push('ACTIVE_KEY')
    if(isNaN(Number(config.MISSED_BLOCKS_THRESHOLD))) config_missing.push('MISSED_BLOCKS_THRESHOLD')

    if(config.USE_SMS_ALERT === enums.ENABLED) {
      if(!process.env.PHONE_NUMBER) env_missing.push('PHONE_NUMBER')
      if(!process.env.NEXMO_API_KEY) env_missing.push('NEXMO_API_KEY')
      if(!process.env.NEXMO_API_SECRET) env_missing.push('NEXMO_API_SECRET')
    }

    if(env_missing.length > 0 || config_missing.length > 0) {
      console.log(`Missing .env variables: ${env_missing}`)
      console.log(`Missing config variables: ${config_missing}`)
      process.exit(-1)
    }
    console.log('all needed variables found')
    console.log('\n'+'----------------------------'+'\n')
  } catch (e) {
    console.error('check_missing_variables', e)
    console.log(`Exiting process - check_missing_variables wasn't sucessful`)
    process.exit(-1)
  }
  
}

let update_witness = async (key, retries = 0) => {
  try {
    if(!config.TEST_MODE || config.TEST_MODE === enums.DISABLED) {
      let op = ['witness_update', { block_signing_key: key, fee: '0.000 STEEM', owner: config.WITNESS, props, url: witness_url }]
      await client.broadcast.sendOperations([op], process.env.ACTIVE_KEY)
    } else {
      console.log('WOULD HAVE UPDATED WITNESS - BUT IN TESTMODE')
    }
  } catch (e) {
    console.error('update_witness', e)
    if(retries < 3) {
      await timeout(2)
      await update_witness(key, retries += 1)
    } else {
      let failover = rpc_failover()
      if(failover) return await get_witness_by_account(0)
    }
  }
}

let send_sms = async (message) => {
  try {
    if(!config.TEST_MODE || config.TEST_MODE === enums.DISABLED) {
      let response = await request.post('https://rest.nexmo.com/sms/json')
      .query({ to: process.env.PHONE_NUMBER, from: 'Witness-Failover', text: message, api_key: process.env.NEXMO_API_KEY, api_secret: process.env.NEXMO_API_SECRET })
      console.log('Send SMS successfully!')
      return response
    } else {
      console.log('WOULD HAVE SEND SMS - BUT IN TESTMODE')
    }
  } catch (e) {
    console.error('send_sms', e)
    return false
  }
}

let get_witness_by_account = async (retries = 0) => {
  try {
    let witness = await client.call('database_api', 'get_witness_by_account', [config.WITNESS])
    if(witness) {
      return witness
    } else {
      throw 'Invalid Witness Object'
    }
  } catch (e) {
    console.error('get_witness_by_account', e)
    if(retries < 3) {
      await timeout(2)
      await get_witness_by_account(retries += 1)
    } else {
      let failover = rpc_failover()
      if(failover) await get_witness_by_account(0)
    }
  }
  
}

let rpc_failover = () => {
  try {
    if (RPC_NODES && RPC_NODES.length > 1) {
      let index = RPC_NODES.indexOf(rpc_node) + 1
  
      if(index === RPC_NODES.length) return false
  
      rpc_node = RPC_NODES[index]
  
      client = new dsteem.Client(rpc_node, { timeout: 8 * 1000 })
      console.log(`Failed over to ${rpc_node} RPC-Node`)
      return true
    }
  } catch (e) {
    console.error('rpc_failover', e)
    return false
  }
}

let timeout = (sec) => {
  return new Promise(resolve => setTimeout(resolve, sec * 1000))
}

const enums = {
  ENABLED: 'ENABLED',
  DISABLED: 'DISABLED'
}

//setInterval(start, config.INTERVAL * 60 * 1000)
start()