var fs 			= require('fs');
var request 	= require('request');
var cheerio		= require('cheerio');
var async 		= require('async');
var progress 	= require('progress');
var utils 		= require('./utils.js');

var rootURL 	= 'https://elixirsips.dpdcart.com';
var loginURL 	= 'https://elixirsips.dpdcart.com/subscriber/login';
var listURL 	= 'https://elixirsips.dpdcart.com/subscriber/content';
var email 		= process.env.email || '';
var password 	= process.env.password || '';

var cookiesJar 	= request.jar()
var dir 		= './tmp';

utils.deleteFolderRecursive(dir);

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

	async.mapSeries(inputLinks,getFile,function(err, results){
		console.log('Finished working on `'+directoryName+'`');
		console.log(results);
	});
}

function getFile(array,cb){
	var filename 	= array[0];
	var fileURL 	= array[1];

	var length = 0;
	var bar;

	request({
		method: 	'GET',
		url: 		fileURL,
		jar: 		cookiesJar
	})
	.on('response', function(response) {
		length = parseInt(response.headers['content-length'], 10);
		
		console.log();
		bar = new progress('downloading '+filename+' [:bar] :percent :etas', {
			complete: '=',
			incomplete: ' ',
			width: 20,
			total: length
		});

		// console.log(filename,response.statusCode,response.headers['content-type']) // 'image/png'
	})
	.on('data', function (chunk) {
		bar.tick(chunk.length);
	})
	.on('end',function(){
		cb(null,filename);
	})
	.pipe(fs.createWriteStream(filename));
}