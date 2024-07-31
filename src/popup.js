"use strict";

import 'font-awesome/css/font-awesome.css'

// Vue Components
import Vue from 'vue'
import Popup from './Popup.vue'
import VirtualRouter from '@/lib/virtual-router.js'
import './styles/shared.scss'
// Set up routes
Vue.prototype.$router = new VirtualRouter()

new Vue({
	render: h => h(Popup)
}).$mount('#app')