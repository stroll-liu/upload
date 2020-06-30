import Upload from './src/index'

export default {
  install: function (Vue) {
    Vue.component(Upload.name, Upload)
  }
}
