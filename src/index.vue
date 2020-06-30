<template>
  <div class="uploadBox" style="display: inline-block;">
    <div class="selectButton" >
      <button :style="basicData.selectButtonStyle">选择文件</button>
      <input type="file" multiple="multiple" @change="fileChange" >
    </div>
    <button :style="basicData.uploadButtonStyle" class="uploadButton" @click="submitBtn()">上传</button>
    <div style="clear: both;"></div>
    <ul>
      <li v-for="(item, index) in uploadFileInfo.fileList || []" :key="index">
        <span>{{item.name}}</span>
        <span :style="`color: ${isUploadStatus[item.isUpload || 'default'].color}`">
          {{isUploadStatus[item.isUpload || 'default'].val}}
        </span>
        <span v-if="!item.isUpload">
          {{item.isUpload === 'success' ? 100 : item.schedule}}%
        </span>
        <div
          class="schedule"
          :style="`
            width: ${item.isUpload === 'success' ? 100 : item.schedule}%;
          `"
        ></div>
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
    initData: {
      type: Object,
      default: () => ({
        chunkSize: 2 * 1024 * 1024,
        uploadUrl: '/file/upload',
        confirmUrl: '/file/merge_chunks'
      })
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
      fileHash: '',
      isUploadStatus: {
        default: { val: '', color: '' },
        success: { val: '✔', color: 'green' },
        fail: { val: '✘', color: 'red' }
      },
      basicData: {
        uploadButtonStyle: '',
        selectButtonStyle: '',
        chunkSize: 2 * 1024 * 1024,
        upload: {
          method: 'post',
          url: '/file/upload'
        },
        confirm: {
          method: 'post',
          url: '/file/merge_chunks'
        }
      }
    }
  },
  mounted () {
    this.init(this.initData)
    this.blobSlice = File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice
  },
  methods: {
    init (params) {
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
    fileChange (e) {
      if (!e.target.files || !e.target.files[0]) return
      this.file = e.target.files
      e.target.files.forEach(item => {
        this.uploadFileInfo.fileList.push({
          name: item.name,
          size: item.size,
          isUpload: false,
          schedule: 0
        })
        const reader = new FileReader()
        reader.readAsArrayBuffer(item)
        reader.onload = e => {
          const bstr = e.target.result
          this.fileHash = MD5(bstr)
        }
        reader.onerror = () => {
          console.warn('文件读取失败！')
        }
      })
    },
    submitBtn () {
      this.file && this.file.forEach(item => {
        this.submit(item)
      })
    },
    async submit (file) {
      file = file || this.file[0]
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
        const sheetHash = MD5(sheet)

        const form = new FormData()
        form.append('file', sheet)
        form.append('name', file.name)
        form.append('total', chunks)
        form.append('index', i)
        form.append('size', file.size)
        form.append('sheetHash', sheetHash)
        form.append('fileHash', this.fileHash)
        const axiosOptions = {
          onUploadProgress: () => {
            // 处理上传的进度
            this.uploadFileInfo.fileList.forEach(item => {
              if (file.name === item.name) {
                item.schedule = (((i+1) / chunks) * 100).toFixed(2)
              }
            })
          },
        };
        // 加入到 Promise 数组中
        axiosPromiseArray.push(axios[this.basicData.upload.method || 'post'](this.basicData.upload.url, form, axiosOptions))
      }
      // 所有分片上传后，请求合并分片文件
      await axios.all(axiosPromiseArray).then(() => {
        const data = {
          size: file.size,
          name: file.name,
          total: chunks,
          fileHash: this.fileHash
        }
        axios[this.basicData.confirm.method || 'get'](this.basicData.confirm.url, data).then(() => {
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
      })
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
</style>
