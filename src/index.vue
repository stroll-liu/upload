<template>
  <div class="uploadBox" style="display: inline-block;">
    <div class="selectButton" >
      <button :style="basicData.selectButtonStyle" @click="submitBtn()">选择文件</button>
      <input type="file" @change="fileChange" >
    </div>
    <button :style="basicData.uploadButtonStyle" class="uploadButton" @click="submitBtn()">上传</button>
    <div style="clear: both;"></div>
    <ul>
      <li v-for="(item, index) in uploadFileInfo.fileList || []" :key="index">
        {{item.name}} {{item.schedule}}%
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
      this.file = e.target.files[0]
      e.target.files.forEach(item => {
        this.uploadFileInfo.fileList.push({
          name: item.name,
          size: item.size,
          schedule: 0
        })
      })
      const reader = new FileReader()
      this.file && reader.readAsArrayBuffer(this.file)
      reader.onload = e => {
        const bstr = e.target.result
        this.fileHash = MD5(bstr)
        
        console.log(this.blobSlice, bstr, new Blob([bstr]),)
      }
      reader.onerror = () => {
        console.warn('文件读取失败！')
      }
    },
    async submitBtn (file) {
      file = file || this.file
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
        form.append('name', file.name)
        form.append('total', chunks)
        form.append('index', i)
        form.append('size', file.size)
        form.append('sheetHash', MD5(sheet))
        form.append('fileHash', this.fileHash)
        const axiosOptions = {
          onUploadProgress: e => {
            // 处理上传的进度
            console.log(chunks, i, e, file)
            this.uploadFileInfo.fileList.forEach(item => {
              if (file.name === item.name) {
                const schedule = ((i+1) / chunks) * 100
                item.schedule = +schedule === 100 ? schedule : schedule.toFixed(2)
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
        axios[this.basicData.confirm.method || 'get'](this.basicData.confirm.url, data).then(res => {
          console.log('上传成功');
          console.log(res.data, file)
        }).catch(err => {
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

</style>
