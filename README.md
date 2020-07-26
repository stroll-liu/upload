# upload
大文件分片上传

## 安装

```js
npm i @stroll/upload

```
## 引入
```js
import Vue from 'vue'
import Upload from '@stroll/upload'

Vue.use(Upload)

```
## 初始化参数
````js
basicData: {
  useName: '', // 可选择加盐后名称 saltName 或原本名称 name ，默认使用 name
  salt: 'salt', // 用于文件名称加盐
  multiple: true, // 是否允许多选，默认可以多选
  chunkSize: 2 * 1024 * 1024, // 分片大小
  amount: 4, // 上传数量
  accept: false, // 上传类型
  typeConfig: [ // 上传类型细化配置
    {
      amount: 2, // 类型上传数量
      accept: 'mp4,mp3' // 类型
    }
  ],
  uploadButton: { // 上传按钮配置
    style: '', // 上传按钮样式
    show: false // 上传按钮是否显示，默认不显示
  },
  selectButton: { // 选择文件按钮配置
    style: '' // 选择文件按钮样式
  },
  upload: { // 分片上传接口配置
    method: 'post', // 分片上传接口方式，默认 post
    url: '/file/upload' // 分片上传接口地址
  },
  confirm: { // 上传完成接口配置
    method: 'post', // 上传完成接口方式，默认 post
    url: '/file/merge_chunks' // 上传完成接口地址
  },
  status: { code: 0, status: 'success', message: '成功' } // 成功回调参数
}
````
## 调用
```html
<sUpload
  @onsubmit='submit' // 上传文件自定义，可不传
  @onselect='select' // 选择文件错误回调，可不传
  :uploadFileInfo='uploadFileInfo' // 上传文件信息
  :configData='basicData' // 初始化 也可使用组件内方法 initConfig(basicData) 进行初始化
/>
```