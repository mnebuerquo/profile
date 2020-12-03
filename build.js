#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var s3 = require('s3');
var async = require('async');
var config = require('./config');
var client = null;
var marked = require('marked');
var pdf = require('html-pdf');
var stripBom = require('strip-bom');
var Handlebars = require('handlebars');
var markdown = '';
var html = '';

/* config description
	{
	"s3Options": {
		"accessKeyId": "aws access key",
		"secretAccessKey": "aws secret"
	},
	"s3Bucket":"sherman-adelson-resume",
	"input": "sherman-adelson-resume.md",
	"htmlcontent":"",
	"tempdir":"/tmp/"
}
*/

function upload(filename,cb){
	if(!client){
		client = s3.createClient({
			s3Options : config.s3Options
		});
		if(!client){
			return cb('Could not create s3 client!');
		}
	}
	var params = {
		localFile: filename,
		s3Params : {
			Bucket: config.s3Bucket,
			Key: path.basename(filename),
			ACL: 'public-read'
		},
	};
	var uploader = client.uploadFile(params);
	uploader.on('error', function(err){
		console.log(err);
		return cb(err);
	});
	uploader.on('end', function(data){
		console.log(data);
		return cb();
	});
}

function done(err){
	if(err){
		console.log(err);
	}
	console.log('Done!');
}

function domd(next)
{
	function afterLoad(err,data){
		if(err){
			console.log(err);
			return next(err);
		}
		markdown = stripBom(data).toString('utf-8');
		next(null);
	}
	fs.readFile(config.input,afterLoad);
}

function dohtml(next){
	// html is global so it can be used by html->pdf conversion
	var content = config.htmlcontent || {};
	content.body = marked(markdown);
	var htmlFilename = path.join(config.tempdir,config.input.replace('.md','.html'));

	function after(err){
		if(err){
			console.log(err);
			return next(err);
		}
		upload(htmlFilename,next);
	}

	function afterload(err,source){
		if(err){
			console.log(err);
			return next(err);
		}
		//compile template, render html
		var template = Handlebars.compile(source.toString('utf-8'));
		html = template(content);
		fs.writeFile(htmlFilename,html,after);
	}

	fs.readFile('template.html',afterload);
}

function dopdf(next){
	var pdfFilename = path.join(config.tempdir,config.input.replace('.md','.pdf'));
	function after(err){
		if(err){
			console.log(err);
			return next(err);
		}
		upload(pdfFilename,next);
	}
	var options = {
		"border": {
			"top": "1in",            // default is 0, units: mm, cm, in, px
			"right": "0.5in",
			"bottom": "0.75in",
			"left": "0.5in"
		},
		"header": {
			"height": ".25in",
			"contents": '<div style="text-align: center;">Sherman Adelson</div>'
		},
		"footer": {
			"height": ".15in",
			"contents": '<span style="color: #444;">{{page}}</span>/<span>{{pages}}</span>'
		},
	};
	console.log("About to create pdf...");
	pdf.create(html).toFile(pdfFilename,after);
}

function build(){
	var steps = [
		domd,
		dohtml,
		dopdf,
	];

	async.waterfall( steps, done );
}

build();
