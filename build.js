#!/usr/env/node

var fs = require('fs');
var path = require('path');
var md2resume = require('markdown-resume');
var s3 = require('s3');
var async = require('async');
var config = require('./config');
var client = null;

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
	var types = ['html','pdf'];

	function generate(type,next){
		var outfilename = '/tmp/'+filename.replace('.md','.'+type);

		function publish(err){
			if(err){
				return next(err);
			}
			upload(outfilename,next);
		}

		function save(err,out){
			if(err){
				return next(err);
			}
			fs.writeFile(outfilename,out,publish);
		}

		md2resume.generate(filename,{format:type},save);
	}

	function done(err){
		if(err){
			console.log(err);
		}
		console.log('Done!');
	}

	async.each(types,generate,done);
}

main();
