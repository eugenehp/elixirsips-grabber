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
var dir 		= './files';
var currentFile = '';

// utils.deleteFolderRecursive(dir);

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
				if(a.length == 2)
					iterateEachContent(a.reverse());
			});

			// iterateEachContent(a.reverse());
		}
	});
}

function iterateEachContent(arrayOfContent){
	async.mapSeries(arrayOfContent,grabContent,function(err,directoriesDownloaded){
		console.log('\nfinished downloading content\n');
		console.log(directoriesDownloaded);
	});
}

function grabContent(contentURL, cb){
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

			storeContent(directoryName, links, cb);
		}
	});
}

function storeContent(directoryName, links, cb){
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
		console.log('==============================================================================');
		console.log('Finished working on `'+directoryName+'`');
		console.log('==============================================================================\n\n');
		cb(err,directoryName);
	});
}

function getFile(array,cb){
	var filename 	= array[0];
	var fileURL 	= array[1];

	var length = 0;
	var bar;

	if( fs.existsSync(filename) ){
		console.log('already downloaded\t', filename);
		cb(null, filename);
	}
	else
		request({
			method: 	'GET',
			url: 		fileURL,
			jar: 		cookiesJar
		})
		.on('response', function(response) {
			length = parseInt(response.headers['content-length'], 10);
			
			bar = new progress('downloading\t'+filename+'\t\t [:bar] :percent :etas', {
				complete: '=',
				incomplete: ' ',
				width: 20,
				total: length
			});

		})
		.on('data', function (chunk) {
			//keeping a track of current file that's being written
			currentFile = filename;
			bar.tick(chunk.length);
		})
		.on('end',function(){
			cb(null,filename);
		})
		.pipe(fs.createWriteStream(filename));
}

function exitHandler(options, err){
	if (options.cleanup) {
		console.log('\nCleaning up, removing current file:',currentFile);
		fs.unlinkSync(currentFile);
	}
    if (err) console.log(err.stack);
    if (options.exit) process.exit();
}

process.on('beforeExit', exitHandler.bind(null,{cleanup:true}));
process.on('exit', exitHandler.bind(null,{cleanup:true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));