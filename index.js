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

// 维护全局常量
const ZH = 'Chinese'
const EG = 'English'
const UNKNOW = 'Unknow'

client.loopBlaze({
  async onMessage (msg) {
    console.log(msg)

    if (msg.category !== 'PLAIN_TEXT') {
      client.sendTextMsg(msg.user_id, '暂只支持普通文本消息')
      return
    }

    // 原始数据
    const rawData = msg.data.toString()

    const lang = checkLanguage(rawData)

    let rawZhData = ''
    let rawEnData = ''
    let totalCost = 0

    // 处理收到的消息
    if (lang === ZH) {
      // 如果是中文，转换成英文
      rawZhData = rawData // 中文
      const translateReturn = await callChatGPTTranslate(ZH, EG, rawData)
      rawEnData = translateReturn.rec
      totalCost += translateReturn.cost
    } else if (lang === EG) {
      // 如果是英文，转换成中文
      rawEnData = rawData // 英文
      const translateReturn = await callChatGPTTranslate(EG, ZH, rawData)
      rawZhData = translateReturn.rec
      totalCost += translateReturn.cost
    } else if (lang === UNKNOW) {
      console.sendTextMsg(msg.user_id, '暂不支持')
    }

    // 处理返回的消息
    const returnEnData = await callChatGPTConversation(rawEnData) // 英文
    totalCost += returnEnData.cost
    const returnZhData = await callChatGPTTranslate(EG, ZH, returnEnData.rec) // 翻译成中文
    totalCost += returnZhData.cost
    // const returnEnData = {rec:''}
    // const returnZhData = {rec:''}

    console.log('消耗💰：' + cost(totalCost))

    const res = `> 用户\n英文：${rawEnData}\n\n中文：${rawZhData}\n\n< 助手\n英文：${returnEnData.rec}\n\n中文：${returnZhData.rec}`
    await client.sendTextMsg(msg.user_id, res)
  },
  // 对返回消息的处理
  onAckReceipt () {}
})

// Functions
// 计算调用成本
function cost (token) {
  const cost = (0.002 / 1000) * token
  return cost
}

// 调用 ChatGPT API，拓展：可以通过指定源语言和目标语言，翻译任何语言
async function callChatGPTTranslate (sourceLang, targetLang, text) {
  msg = [
    {
      role: 'system',
      content: `You are a helpful assistant that translates ${sourceLang} to ${targetLang}.`
    },
    {
      role: 'user',
      content: `Translate the following ${sourceLang} text to ${targetLang}: ${text}`
    }
  ]
  // 接受返回值
  let obj = await queryChatGPT(msg)
  return { rec: obj.rec, cost: obj.token }
}

// 调用chatGPT进行对话
async function callChatGPTConversation (text) {
  msg = [
    {
      role: 'system',
      content:
        "First of all, If the question is not a sentence or they are some seprecated words, please help to generate a sentence with the question to start a conversation.I want you to act as a spoken English teacher and improver. I will speak to you in English and you will reply to me in English to practice my spoken English.  I want you to keep your reply neat, limiting the reply to 50 words. I want you to strictly correct my grammar mistakes, typos, and factual errors. I want you to ask me a question in your reply. Now let's start practicing, you could ask me a question first. Remember, I want you to strictly correct my grammar mistakes, typos, and factual errors."
    },
    {
      role: 'user',
      content: text
    }
  ]
  // 接受返回值
  let obj = await queryChatGPT(msg)
  return { rec: obj.rec, cost: obj.token }
}

async function queryChatGPT (msg) {
  const completion = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages: msg
  })
  // 使用正则去掉前后的 "
  const rec = completion.data.choices[0].message.content.replace(
    /^"(.*)"$/,
    '$1'
  )
  // 获取token 数量
  const token = completion.data.usage.total_tokens
  return { rec: rec, token: token }
}

// 检查语言
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
    return ZH
  } else if (chineseCount < englishCount) {
    return EG
  } else {
    console.log(UNKNOW)
    return UNKNOW
  }
}
