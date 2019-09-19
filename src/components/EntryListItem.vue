<script>
	import { parseUrl } from '$lib/utils.js'
	const OTP = require('keeweb/app/scripts/util/otp.js');export default {
		props: {
			entry: Object,
			unlockedState: Object
		},
		computed: {
			header: function() {
				if (this.entry.title.length > 0)
					return this.entry.title
				return this.entry.url
			}
		},
		watch: {
			// When the element becomes active, scroll it into view.
			'entry.view_is_active': function(val) {
				if (val) {
					this.$el.scrollIntoView({
						block: "end",
						inline: "nearest",
						behavior: "smooth"
					});
					const otpUrl = this.unlockedState.getDecryptedAttribute(this.entry, "otp");
					if (otpUrl.length) {
						this.setupOTP(otpUrl)
					}
				} else {
					clearInterval(this.otp_loop)
				}
			}
		},
		data() {
		  return {
			  // OTP
			  otp: false,
			  otp_loop: undefined,
			  otp_value: "",
			  keyHandler: e => {
				  if ((e.ctrlKey || e.metaKey) && e.key == "/" && !e.altKey && !e.shiftKey)  {
					  this.copyOtp(e);
				  }
			  }
		  }
		},
		methods: {
			details(e) {
				this.$router.route("/entry-details/" + this.entry.id)},
			setupOTP(url) {
				let totp = OTP.parseUrl(url)
				this.otp = typeof totp.key !== "undefined"
				let do_otp = () => {
					totp.next(code => {
						this.otp_value = code;
					})
				}
				this.otp_loop = setInterval(do_otp, 2000)
				do_otp()
			},
			autofill(e) {
				e.stopPropagation()
				console.log("autofill")
				this.unlockedState.autofill(this.entry);
			},
			copy(e) {
				e.stopPropagation()
				console.log("copy")
				this.unlockedState.copyPassword(this.entry);
			},
			copyOtp(e) {
				e.stopPropagation()
				this.unlockedState.copyTotp(this.otp_value);
			},
			parseUrl(url) {
				url = url.indexOf('http') < 0 ? 'http://' + url : url
				let a = document.createElement('a')
				a.href = url
				return a
			}
		},
		mounted() {
			window.addEventListener("keydown", this.keyHandler);
		}
	}
</script>

<template>
	<div class="entry-list-item selectable between flair" v-bind:class="{ active: entry.view_is_active }" v-on:click="details">
		<div class="text-info" v-bind:class="{ strike: entry.is_expired }">
			<span class="header">{{ header }}</span>
			<br>
			<span class="user">
				{{ entry.userName || '&#60;empty&#62;' }}
			</span>
		</div>
        <div class="otp-block valign-wrapper" v-bind:class="{ hidden: !entry.view_is_active }">
            {{ otp_value }}
        </div>
        <div class="buttons">
			<span class="fa-stack otp" v-if="otp" v-on:click="copyOtp">
				<i class="fa fa-circle fa-stack-2x"></i>
				<i class="fa fa-clock-o fa-stack-1x fa-inverse"></i>
			</span>
			<span class="fa-stack copy" v-on:click="copy">
				<i class="fa fa-circle fa-stack-2x"></i>
				<i class="fa fa-clipboard fa-stack-1x fa-inverse"></i>
			</span>
			<span class="fa-stack autofill" v-on:click="autofill">
				<i class="fa fa-circle fa-stack-2x"></i>
				<i class="fa fa-magic fa-stack-1x fa-inverse"></i>
			</span>
		</div>
	</div>
</template>

<style lang="scss">
	@import "../styles/settings.scss";
	.entry-list-item {
		transition: all 0.3s ease;
		width: 100%;
		padding: 10px $wall-padding;
		box-sizing: border-box;
		border-bottom: 1px solid $light-gray;
		background-color: #fff;
		display: flex;
		.header {
			font-size: 16px;
		}
		.user {
			font-size: 12px;
		}
		.buttons {
			font-size: 18px;
			display: flex;
			justify-content: space-between;
			box-sizing: border-box;
			}
		.otp-block {
			font: 16px monospace;
		}
		.copy,
		.autofill,
		.otp {
			opacity: 0.2;
		}
		.copy:hover,
		.autofill:hover,
		.otp:hover {
			opacity: 0.8;}
		.hidden {
			display: none;
		}
		&.active {
			background-color: $highlighted;
			padding-left: 20px;
		}
	}

.strike {
  text-decoration: line-through;
}
</style>
