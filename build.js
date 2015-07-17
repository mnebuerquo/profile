#!/usr/env/node

var fs = require('fs');
var path = require('path');
//var md2resume = require('markdown-resume');
var s3 = require('s3');
var async = require('async');
var config = require('./config');
var client = null;
var marked = require('marked');
var pdf = require('html-pdf');

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
		return cb(err);
	});
	uploader.on('end', function(data){
		console.log(data);
		return cb();
	});
}

function main(){
	var filename = 'sherman-adelson-resume.md';
	var html = ''; 
	var htmlFilename = '/tmp/'+filename.replace('.md','.html');
	var pdfFilename = '/tmp/'+filename.replace('.md','.pdf');
	function done(err){
		if(err){
			console.log(err);
		}
		console.log('Done!');
	}

	function afterSave(err,res){
		upload(htmlFilename,function(){
			upload(pdfFilename,done);
		});
	}

	function makePDF(err){
		//err is file write error
		if(err){
			return done(err);
		}
		pdf.create(html).toFile(pdfFilename,afterSave);
	}

	function makeHtml(err,data){
		// err is file read error
		if(err){
			return done(err);
		}
		// closure scope shares html with other functions
		html = marked(data.toString('utf8'));

		fs.writeFile(htmlFilename,html,makePDF);
	}

	fs.readFile(filename,makeHtml);
}

main();
