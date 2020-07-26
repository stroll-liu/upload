<template>
  <div class="uploadBox" style="display: inline-block;">
    <div class="selectButton" id="stroll-uploadBox">
      <button :style="basicData.selectButton.style" @click="selectButton">选择文件</button>
    </div>
    <button v-if="basicData.uploadButton.show" :style="basicData.uploadButton.style" class="uploadButton" @click="submitBtn()">上传</button>
    <div style="clear: both;"></div>
    <ul class="fileList">
      <li v-for="(item, index) in uploadFileInfo.fileList || []" :key="index">
        <span class="fl mr10" :style="`color: ${isUploadStatus[item.isUpload || 'default'].color}`">
          {{isUploadStatus[item.isUpload || 'default'].val}}
        </span>
        <div class="fl mr10">
          <span>{{item[basicData.useName || 'name']}}</span>

          <div
            class="schedule"
            :style="`
              width: ${item.isUpload === 'success' ? 100 : item.schedule}%;
            `"
          ></div>
        </div>
        <span class="fl" v-if="!item.isUpload">
          {{item.isUpload === 'success' ? 100 : item.schedule}}%
        </span>
        <a
          class="fl mr10"
          title="重新上传"
          v-show="item.isUpload === 'fail'"
          @click="reUpload(item)"
        >➠</a>
        <a title="删除" class="fl ptr" @click="delFile(item)" >☒</a>
        <div style="clear: both;"></div>
      </li>
    </ul>
  </div>
</template>

<script>
import MD5 from 'md5'
import axios from 'axios'
export default {
  name: 'sUpload',
  props: {
    configData: {
      type: Object,
      default: () => ({})
    },
    uploadFileInfo: {
      type: Object,
      default: () => ({
        fileList: []
      })
    },
  },
  data () {
    return {
      file: null,
      blobSlice: null,
      isUploadStatus: {
        default: { val: '', color: '' },
        success: { val: '✔', color: 'green' },
        fail: { val: '✘', color: 'red' }
      },
      basicData: {
        useName: '',
        salt: 'salt',
        multiple: true,
        chunkSize: 2 * 1024 * 1024,
        amount: 4,
        accept: false,
        typeConfig: [
          { amount: 2, accept: 'mp4,mp3' },
          { amount: 2, accept: 'jpg' }
        ],
        uploadButton: {
          style: '',
          show: false
        },
        selectButton: {
          style: ''
        },
        upload: {
          method: 'post',
          url: '/file/upload'
        },
        confirm: {
          method: 'post',
          url: '/file/merge_chunks'
        },
        status: { code: 0, status: 'success', message: '成功' }
      },
      deep: ['upload', 'confirm', 'selectButton', 'uploadButton', 'typeConfig']
    }
  },
  mounted () {
    this.initConfig(this.configData)
    this.blobSlice = File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice
  },
  methods: {
    initConfig (params) {
      Object.keys(params).forEach(item => {
        if (this.deep.includes(item)) {
          Object.keys(params[item]).forEach(key => {
            this.basicData[item][key] = params[item][key]
          })
        } else {
          this.basicData[item] = params[item]
        }
      })
    },
    initData () {
      this.file = null
      this.uploadFileInfo.fileList = []
    },

    selectButton () {
      const strollUploadBox = document.getElementById('stroll-uploadBox')
      const inputFile = document.createElement('input')
      inputFile.setAttribute('type', 'file')
      inputFile.setAttribute('multiple', this.basicData.multiple)
      inputFile.setAttribute('accept', this.basicData.accept)
      inputFile.setAttribute('title', '')

      strollUploadBox.appendChild(inputFile)

      inputFile.click()
      inputFile.onchange = async (e) => {
        await this.selectChange(e)
        if (!this.basicData.uploadButton.show) {
          await this.submitBtn()
        }
      }
    },
    async selectChange (e) {
      
      const filesLeng = e.target.files.length
      const fileListLeng = this.uploadFileInfo.fileList.length
      if ((filesLeng + fileListLeng) > this.basicData.amount || fileListLeng >= this.basicData.amount) {
        this.Callback(this.getStatus(1001), 'select')
        return false
      }

      const getTypeLeng = await this.getTypeLeng(e.target.files)
      let beyondType = {}
      const amount = Object.keys(getTypeLeng.typeObject).every(key => {
        beyondType = {
          key,
          amount: getTypeLeng.typeConfigLing[key]
        }
        if (getTypeLeng.typeObject[key] <= getTypeLeng.typeConfigLing[key]) {
          return true
        } else {
          return false
        }
      })
      if (!amount) {
        await this.Callback(this.getStatus(1003, beyondType), 'select')
        return
      }
      
      return await this.addUploadList(e.target.files)
    },
    async addUploadList (files) {
      const nameArr = await this.nameArr()
      files.forEach(async (item) => {
        await this.defineProperty(item)

        if (!nameArr.includes(item.name)) {
          this.uploadFileInfo.fileList.push({
            name: item.name,
            saltName: item.saltName,
            size: item.size,
            isUpload: false,
            schedule: 0
          })
        } else {
          await this.Callback(this.getStatus(1002, {
            name: item.name,
            saltName: item.saltName,
            size: item.size
          }), 'select')
          return false
        }
      })
    },
    async delFile (row) {
      this.uploadFileInfo.fileList.forEach((item, index) => {
        if (item.name === row.name) {
          this.uploadFileInfo.fileList.splice(index, 1)
        }
      })
    },
    async submitBtn () {
      const inputEl = await this.getInput()
      inputEl.forEach(el => {
        el.files.forEach(item => {
          this.submit(item)
        })
      })
    },
    async reUpload (params) {
      const inputEl = await this.getInput()
      inputEl.forEach(el => {
        el.files.forEach(item => {
          this.uploadFileInfo.fileList.forEach(async val => {
            if (item.name === params.name && params.name === val.name) {
              val.isUpload = false
              val.schedule = 0
              await this.defineProperty(item, { isUpload: false, schedule: 0 })
              this.submit(item)
            }
          })
        })
      })
    },
    async submit (file) {
      if (!file || file.isUpload) {
        return
      }
      const nameArr = await this.nameArr()
      if (this.$listeners.onsubmit) {
        this.$emit('onsubmit', { file, nameArr})
        return
      }
      if (!nameArr.includes(file.name)) return
      const axiosPromiseArray = []
      const fileSize = file.size
      const chunks = Math.ceil(fileSize / this.basicData.chunkSize)

      for (let i = 0; i < chunks; i++) {
        const start = i * this.basicData.chunkSize;
        const end = Math.min(file.size, start + this.basicData.chunkSize)
        const sheet = this.blobSlice.call(file, start, end)

        const form = new FormData()
        form.append('file', sheet)
        form.append('name', `${file.name}`)
        form.append('total', chunks)
        form.append('index', i)
        form.append('size', file.size)
        form.append('fileHash', MD5(file.name))
        const axiosOptions = {
          onUploadProgress: () => {
            // 处理上传的进度
            this.uploadFileInfo.fileList.forEach(item => {
              if (file.name === item.name) {
                item.schedule = (((i+1) / chunks) * 100).toFixed(2)
              }
            })
          },
        }
        // 加入到 Promise 数组中
        axiosPromiseArray.push(axios[this.basicData.upload.method](this.basicData.upload.url, form, axiosOptions))
      }
      // 所有分片上传后，请求合并分片文件
      const mergeChunks = async () => {
        const data = {
          size: file.size,
          name: `${file.name}`,
          total: chunks,
          fileHash: MD5(file.name)
        }
        await axios[this.basicData.confirm.method](this.basicData.confirm.url, data).then(() => {
          this.uploadFileInfo.fileList.forEach(async item => {
            if (file.name === item.name) {
              item.isUpload = 'success'
              await this.defineProperty(file, { isUpload: 'success', schedule: 100 })
            }
          })
        }).catch(err => {
          this.uploadFileInfo.fileList.forEach(async item => {
            if (file.name === item.name) {
              item.isUpload = 'fail'
              await this.defineProperty(file, { isUpload: 'fail', schedule: 100 })
            }
          })
          console.log(err)
        })
        if (this.uploadFileInfo.fileList.every(item => item.isUpload === 'success')) {
          this.delFileInput()
        }
      }
      await axios.all(axiosPromiseArray).then(async res => {
        mergeChunks(res)

      }).catch(async (err) => {
        mergeChunks(err)
        console.log(err)
      })
    },
    async delFileInput () {
      const inputEl = await this.getInput()
      inputEl[0] && inputEl[0].parentNode.removeChild(inputEl[0])
      if (inputEl.length > 0) this.delFileInput()
    },
    async defineProperty (item, Reset) {
      const { schedule, isUpload } = Reset || {}
      const FileName = item.name
      !Reset && Object.defineProperty(item, 'saltName', {
        value: `${this.basicData.salt}${FileName}`,
        writable: true //设置属性为可写
      })
      Object.defineProperty(item, 'schedule', {
        value: schedule || 0,
        writable: true
      })
      Object.defineProperty(item, 'isUpload', {
        value: isUpload || false,
        writable: true
      })
    },
    async getStatus (code, item) {
      let row = { code: 0, status: 'success', message: '成功' }
      switch (code) {
        case 1001:
          row = {
            code: 1001,
            status: 'error',
            message: `上传数量超出，上限为${this.basicData.amount}`
          }
          break
        case 1002:
          row = {
            code: 1002,
            status: 'error',
            message: `文件 ${item.neme} 重复上传`,
            errFile: item
          }
          break
        case 1003:
          row = {
            code: 1003,
            status: 'error',
            message: `上传文件类型 ${item.key} 数量超出，上限为${item.amount}`,
            errFile: item
          }
          break
        default:
          row = { code: 0, status: 'success', message: '成功' }
      }
      return row
    },
    async getInput () {
      const strollUploadBox = document.getElementById('stroll-uploadBox')
      const fileInput = strollUploadBox.getElementsByTagName("input")
      return fileInput
    },
    async nameArr () {
      return this.uploadFileInfo.fileList.map(item => item.name)
    },
    async md5Hash (result) {
      return new Promise((resolve, reject) => {
        try {
          const md5Hash = MD5(result)
          resolve(md5Hash)
        } catch (error) {
          reject(error)
        }
      })
    },
    async getTypeLeng (files) {
      return new Promise((resolve, reject) => {
        try {
          const filesArr = []
          const typeObject = {}
          files.forEach(item => {
            const nameArr = item.name.split('.')
            filesArr.push(nameArr[nameArr.length - 1])
          })
          const fileListArr = this.uploadFileInfo.fileList.map(item => {
            const nameArr = item[this.basicData.useName || 'name'].split('.')
            return nameArr[nameArr.length - 1]
          })
          const filesTypeLeng = filesArr.reduce(function(prev,next){
            prev[next] = (prev[next] + 1) || 1
            return prev
          }, {})
          const filesListLeng = fileListArr.reduce(function(prev,next){
            prev[next] = (prev[next] + 1) || 1
            return prev
          }, {})
          let typeConfigLing = null
          if (this.basicData.typeConfig && this.basicData.typeConfig.length && this.basicData.typeConfig[0].accept) {
            typeConfigLing = this.basicData.typeConfig.reduce(function(prev,next){
              prev[next.accept] = next.amount || 0
              return prev
            }, {})
          }
          if (typeConfigLing) {
            Object.keys(typeConfigLing).forEach(key => {
              typeObject[key] = 0
              const typeArr = key.split(',')
              Object.keys(filesTypeLeng).forEach(item => {
                if (typeArr.includes(item)) {
                  typeObject[key] = typeObject[key] + filesTypeLeng[item]
                }
              })
              Object.keys(filesListLeng).forEach(item => {
                if (typeArr.includes(item)) {
                  typeObject[key] = typeObject[key] + filesListLeng[item]
                }
              })
            })
          }
          resolve({ typeObject, typeConfigLing })
        } catch (error) {
          reject(error)
        }
      })
    },
    async Callback (res, type) {
      if (this.$listeners.onselect && type === 'select') {
        this.$emit('onselect', res)
        return
      }
      console.log(res.message)
    }
  }
}
</script>

<style scopen >
.uploadBox button {
  margin: 0;
  padding: 0;
  border: 1px solid transparent;
  outline: none;
  color: #fff;
  font-size: 14px;
  background-color: #2d8cf0;
  border-color: #2d8cf0;
  padding: 4px 15px;
  border-radius: 4px;
}
.uploadBox button:hover, .selectButton:hover button {
  color: #fff;
  background-color: #57a3f3;
  border-color: #57a3f3;
}
.selectButton input {
  position: fixed;
  /* font-size: 200px; */
  right: -1000px;
  top: -10000;
  opacity: 0;
}
.selectButton {
  float: left;
  position: relative;
  display: inline-block;
  overflow: hidden;
  margin-right: 10px;
}
.uploadButton {
  float: left;
}
.schedule{
  height: 3px;
  max-width: 720px;
  border-radius: 50px;
  background-color: green;
}
.fl {
  float: left;
}
.fr {
  float: right;
}
.mr10 {
  margin-right: 10px;
}
.ml10 {
  margin-left: 10px;
}
.ptr {
  display:none; 
  color: red;
}
.fileList li:hover .ptr{
  display: inline;
}
</style>
