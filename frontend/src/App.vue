<template>
  <div class="main">
    <div class="content">
    	<h1>Happy Hour</h1>
    </div>
  </div>
</template>

<script>
const axios = require('axios')

export default {
  name: 'app',
  mounted() {
  	axios.get('http://startupbears.com/api/sentiment').then(res => {
  		console.log(res)
  	})
  }
}
</script>

<style lang="scss">
* {
	margin: 0;
	padding: 0;
	position: relative;
	font-family: Helvetica Neue, Arial, sans-serif;
	font-weight: 300;
}

h1 {
	font-weight: 100;
	font-size: 4rem;
}

.main {
	max-width: 980px;
	margin: 0 auto;
}

.content {
	padding: 3rem;
}
</style>
