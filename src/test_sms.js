const dotenv = require('dotenv').config()
const request = require('superagent')

let test = async () => {
  console.log('Testing SMS')
  await send_sms()
  console.log('Finished testing')
}

let send_sms = async () => {
  try {
    let response = await request.post('https://rest.nexmo.com/sms/json')
    .query({ to: process.env.PHONE_NUMBER, from: 'WITNESS', text: 'TEST', api_key: process.env.NEXMO_API_KEY, api_secret: process.env.NEXMO_API_SECRET })
    console.log('success', response.text)
  } catch (e) {
    console.error('send_sms', e)
    return false
  }
}

test()