const Koa = require('koa')
const app = new Koa()
const Router = require('koa-router')
const multer = require('koa-multer')
const path = require('path')
const fs = require('fs-extra')
const koaBody = require('koa-body')

const mkdirsSync = (dirname) => {
  if(fs.existsSync(dirname)) {
    return true
  } else {
    if (mkdirsSync(path.dirname(dirname))) {
      fs.mkdirSync(dirname)
      return true
    }
  }
}
const uploadPath = path.join(__dirname, 'uploads') // 接收成功后文件存放目录
const uploadTempPath = path.join(uploadPath, 'temp') // 文件碎片存放目录
const upload = multer({ dest: uploadTempPath })
const router = new Router()
app.use(koaBody())

router.post('/file/upload', upload.single('file'), async (ctx, next) => {
  const {
    name,
    total,
    index,
    size,
    hash,
    fileHash
  } = ctx.req.body

  const chunksPath = path.join(uploadPath, (hash || fileHash), '/')
  if(!fs.existsSync(chunksPath)) mkdirsSync(chunksPath)
  fs.renameSync(ctx.req.file.path, chunksPath + (hash || fileHash) + '-' + index)
  ctx.status = 200
  ctx.res.end('Success')
})

router.post('/file/merge_chunks', async (ctx, next) => {
  const {    
    size, 
    name, 
    total, 
    hash,
    fileHash
  } = ctx.request.body
  // 根据hash值，获取分片文件。
  // 创建存储文件
  // 合并
  const chunksPath = path.join(uploadPath, (hash || fileHash), '/')
  const filePath = path.join(uploadPath, name)
  // 读取所有的chunks 文件名存放在数组中
  const chunks = fs.readdirSync(chunksPath)
  // 创建存储文件
  fs.writeFileSync(filePath, '')
  console.log(chunks)
  if(chunks.length !== total || chunks.length === 0) {
    fs.rmdirSync(chunksPath)
    ctx.status = 200
    ctx.res.end('切片文件数量不符合')
    return
  }
  for (let i = 0; i < total; i++) {
    // 追加写入到文件中
    fs.appendFileSync(filePath, fs.readFileSync(chunksPath + (hash || fileHash) + '-' +i))
    // 删除本次使用的chunk    
    fs.unlinkSync(chunksPath + (hash || fileHash) + '-' +i)
  }
  fs.rmdirSync(chunksPath)
  // 文件合并成功，可以把文件信息进行入库。
  ctx.status = 200
  ctx.res.end('合并成功')
})
app.use(router.routes())
app.use(router.allowedMethods())
app.listen(7000, () => {
  console.log('服务7000端口已经启动了')
})
