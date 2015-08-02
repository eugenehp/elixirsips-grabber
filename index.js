var fs 		= require('fs');
var request = require('request');
var cheerio	= require('cheerio');
var async 	= require('async');

var rootURL 	= 'https://elixirsips.dpdcart.com';
var loginURL 	= 'https://elixirsips.dpdcart.com/subscriber/login';
var listURL 	= 'https://elixirsips.dpdcart.com/subscriber/content';
var email 		= process.env.email || '';
var password 	= process.env.password || '';

var cookiesJar 	= request.jar()
var dir 		= './tmp';

if (!fs.existsSync(dir)){
	fs.mkdirSync(dir);
}

// console.log(email,password);

if( email == '' || password == '')
	return new Error('Make sure you have email & password in your environment variables');

request.get(loginURL,function(error, response, body){
	if( !error && response.statusCode == 200 ){
		var $ = cheerio.load(body);
		var form = $('form').get(0);
		sendForm(form.attribs.action);
	}
})

function sendForm(action){
	request({
		method: 	'POST',
		url: 		rootURL+action, 
		jar: 		cookiesJar,
		form: {
			username: email,
			password: password
		}
	}, function(err,response,body){
		getListOfContent()
	});
}

function getListOfContent(){

	request({
		method: 	'GET',
		url: 		listURL,
		jar: 		cookiesJar
	},function(error, response, body){
		if( !error && response.statusCode == 200 ){
			var $ = cheerio.load(body);

			var a = [];
			$('div.content-post-meta > a').each(function(){
				a.push( 'https://elixirsips.dpdcart.com' + $(this).attr('href') );
			});

			iterateEachContent(a.reverse());
		}
	});
}

function iterateEachContent(arrayOfContent){
	// console.log(arrayOfContent);
	grabContent(arrayOfContent[0]);
}

function grabContent(contentURL){
	request({
		method: 	'GET',
		url: 		contentURL,
		jar: 		cookiesJar
	},function(error, response, body){
		if( !error && response.statusCode == 200 ){
			var $ = cheerio.load(body);

			var directoryName = dir + '/' + $('div.section-header.order').text();
			
			var links = [];
			$('div.blog-entry > ul > li > a').each(function(){
				var title 	= $(this).text();
				var link 	= 'https://elixirsips.dpdcart.com' + $(this).attr('href');
				links.push({
					title: title,
					link: link
				});
			});

			storeContent(directoryName, links);
		}
	});
}

function storeContent(directoryName, links){
	if (!fs.existsSync(directoryName)){
		fs.mkdirSync(directoryName);
	}

	var inputLinks = [];

	for (var i = links.length - 1; i >= 0; i--) {
		var filename 	= directoryName + '/' +links[i].title;
		var fileURL 	= links[i].link;

		inputLinks.push([filename,fileURL]); // [ ['text.txt','g.co/text.txt'], ['image.png','g.co/image.png'] ]
	};

	async.mapSeries(result,getFile,function(err, results){
		console.log('Finished working on `'+directoryName+'`');
		console.log(results);
	});
}

function getFile(array,cb){
	var filename 	= array[0];
	var fileURL 	= array[1];

	var r = request({
		method: 	'GET',
		url: 		fileURL,
		jar: 		cookiesJar
	})
	.on('response', function(response) {
		console.log(filename,response.statusCode,response.headers['content-type']) // 'image/png'
	})
	.pipe(fs.createWriteStream(filename))

	r.on('end',cb);
}