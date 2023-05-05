const { BlazeClient } = require('mixin-node-sdk')
const config = require('./config')

const { Configuration, OpenAIApi } = require('openai')
const configuration = new Configuration({
  apiKey: config.apiKey
})
const openai = new OpenAIApi(configuration)

const client = new BlazeClient(
  {
    pin: config.pin,
    client_id: config.client_id,
    session_id: config.session_id,
    pin_token: config.pin_token,
    private_key: config.private_key
  },
  { parse: true, syncAck: true }
)

client.loopBlaze({
  async onMessage (msg) {
    console.log(msg)
    // 原始数据
    const rawData = msg.data.toString()

    const lang = checkLanguage(rawData)

    var rawZhData = ''
    var rawEnData = ''

    // 处理收到的消息
    if (lang === 'chinese') {
      // 如果是中文，转换成英文
      rawZhData = rawData // 中文
      rawEnData = await translate(lang, rawData) // 英文
    } else if (lang === 'english') {
      // 如果是英文，转换成中文
      rawEnData = rawData // 英文
      rawZhData = await translate(lang, rawData) // 中文
    } else if (lang === 'unknow') {
      console.sendTextMsg(msg.user_id, '暂不支持')
    }

    // 处理返回的消息
    const returnZhData = '你好'
    const returnEnData = 'How are you.'

    const res = `> 用户\n中文：${rawZhData}\n英文：${rawEnData}\n\n< 助手\n中文：${returnZhData}\n英文：${returnEnData}`
    await client.sendTextMsg(msg.user_id, res)
  },
  // 对返回消息的处理
  onAckReceipt () {}
})

async function translate (lang, text) {
  var rec
  if (lang === 'chinese') {
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant that translates Chinese to English.'
        },
        {
          role: 'user',
          content: `Translate the following Chinese text to English: ${text}`
        }
      ]
    })
    console.log(completion.data.choices[0].message.content)
    rec = completion.data.choices[0].message.content
  } else if (lang === 'english') {
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant that translates English to Chinese.'
        },
        {
          role: 'user',
          content: `Translate the following English text to Chinese: ${text}`
        }
      ]
    })
    console.log(completion.data.choices[0].message.content)
    rec = completion.data.choices[0].message.content
  }
  return rec
}

function checkLanguage (rawData) {
  //   const chineseRegex = /[\u4e00-\u9fa5]/g
  const chineseRegex = /[\u4e00-\u9fa5]/
  const englishRegex = /[a-z]/gi

  let chineseCount = 0
  let englishCount = 0

  const chineseResult = rawData.match(chineseRegex)
  const englishResult = rawData.match(englishRegex)

  if (chineseResult) {
    chineseResult.forEach(c => chineseCount++)
  }
  if (englishResult) {
    englishResult.forEach(e => englishCount++)
  }
  if (chineseCount > englishCount) {
    console.log('字符串中中文字符更多')
    return 'chinese'
  } else if (chineseCount < englishCount) {
    console.log('字符串中英文字符更多')
    return 'english'
  } else {
    console.log('unknow')
  }
}

// 小技巧
// 开启自动换行，命令行输入：Toggle Word Wrap
