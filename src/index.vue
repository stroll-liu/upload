<template>
  <div class="uploadBox" style="display: inline-block;">
    <div class="selectButton" >
      <button :style="basicData.selectButton.style">选择文件</button>
      <input
        type="file"
        id="stroll-file"
        title=" "
        :multiple="basicData.multiple"
        :accept="basicData.accept"
        @change="fileChange"
      >
    </div>
    <button v-if="basicData.uploadButton.show" :style="basicData.uploadButton.style" class="uploadButton" @click="submitBtn()">上传</button>
    <div style="clear: both;"></div>
    <ul class="fileList">
      <li v-for="(item, index) in uploadFileInfo.fileList || []" :key="index">
        <span class="fl mr10" :style="`color: ${isUploadStatus[item.isUpload || 'default'].color}`">
          {{isUploadStatus[item.isUpload || 'default'].val}}
        </span>
        <div class="fl mr10">
          <span>{{item.name}}</span>

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
        salt: 'salt',
        multiple: true,
        chunkSize: 2 * 1024 * 1024,
        amount: 2,
        accept: false,
        uploadButton: {
          style: '',
          show: true
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
      }
    }
  },
  mounted () {
    this.initConfig(this.configData)
    this.blobSlice = File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice
  },
  methods: {
    initConfig (params) {
      Object.keys(params).forEach(item => {
        if (['upload', 'confirm'].includes(item)) {
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
    async selectCallback (res) {
      this.$emit('selectCallback', res)
    },
    async delFile (row) {
      const arr = []
      this.file.forEach(item => {
        if (item.name !== row.name) {
          arr.push(item)
        }
      })
      this.uploadFileInfo.fileList.forEach((item, index) => {
        if (item.name === row.name) {
          this.uploadFileInfo.fileList.splice(index, 1)
        }
      })
      this.file = arr
      this.$emit('delFile', row, this.file)
    },
    async fileChange (e) {
      if (!e.target.files || !e.target.files[0]) return
      if ((+e.target.files.length + +this.uploadFileInfo.fileList.length) > this.basicData.amount || this.uploadFileInfo.fileList.length >= this.basicData.amount) {
        await this.selectCallback(this.getStatus(1001))
        return false
      }
      for (var i = 0; i < e.target.files.length; i++) {
        const FileName = e.target.files[i].name
        Object.defineProperty(e.target.files[i], 'name', {
          writable: true //设置属性为可写
        })
        e.target.files[i].name = `${this.basicData.salt}${FileName}`
      }
      this.file = e.target.files
      const inputFile = document.getElementById('stroll-file')
      inputFile.setAttribute('type', 'text')
      inputFile.setAttribute('type', 'file')
      await this.getFile(this.file)
    },
    async getFile (file) {
      file && file.forEach(async item => {
        const reader = new FileReader()
        reader.readAsArrayBuffer(item)
        reader.onload = async e => {
          this.uploadFileInfo.fileList.push({
            name: item.name,
            size: item.size,
            isUpload: false,
            fileHash: e.target.result,
            schedule: 0
          })
          if (!this.basicData.uploadButton.show) {
            await this.submit(item)
          }
        }
        reader.onerror = () => {
          console.warn('文件读取失败！')
        }
      })
    },
    async submitBtn (file) {
      file = file || this.file
      file && this.file.forEach(item => {
        this.submit(item)
      })
    },
    async reUpload (params) {
      this.file && this.file.forEach(item => {
        this.uploadFileInfo.fileList.forEach(el => {
          if (item.name === params.name && params.name === el.name) {
            el.isUpload = false
            el.schedule = 0
            this.submit(item)
          }
        })
      })
    },
    async submit (item) {
      const file = item || this.file[0]
      if (!file) {
        return
      }
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
          this.uploadFileInfo.fileList.forEach(item => {
            if (file.name === item.name) {
              item.isUpload = 'success'
            }
          })
        }).catch(err => {
          this.uploadFileInfo.fileList.forEach(item => {
            if (file.name === item.name) {
              item.isUpload = 'fail'
            }
          })
          console.log(err)
        })
      }
      await axios.all(axiosPromiseArray).then(async () => {
        mergeChunks()
      }).catch(async (err) => {
        mergeChunks()
        console.log(err)
      })
    },
    async getStatus (code) {
      let row = { code: 0, status: 'success', message: '成功' }
      switch (code) {
        case 1001:
          row = {
            code: 1001,
            status: 'error',
            message: `上传数量超出，上限为${this.basicData.amount}`
          }
          break
        default:
          row = { code: 0, status: 'success', message: '成功' }
      }
      return row
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
  position: absolute;
  font-size: 200px;
  right: 0;
  top: 0;
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
