var express = require('express');
var formidable = require('formidable');
var crypto = require('crypto');
var ejs = require('ejs');
var sql = require(__ROOTDIR__+'/config/mysql');
var config = require(__ROOTDIR__+'/config/config');
var com = require(__ROOTDIR__+'/config/common');
var base = require(__ROOTDIR__+'/config/base');

// 查询用户
exports.friend=function (req, res, next) {

       new sql.runMysql(()=>{
       	    return base.returnjson(res,100,"查询失败");
        } )
       .then(()=>{
       	    return 'select * from z_friends where uid ="'+req.body.uid+'"';
        },
       	(data,_this)=>{
     	    if(data.length==0){
		          var email = 'insert into z_member (uid,uids) values ('+req.body.uid+','+req.body.fid+')';
		          sql.runSql(email,function(err,data){
				     	    if(err){
				     	    	    return base.returnjson(res,100,"查询失败");
				     	    }
				            return base.returnjson(res,200,'添加成功');
		          })
		          _this.endHandle = true;
     	    }
       	})
       .then('select uids from z_friends where uid ="'+req.body.uid+'"',
       	(data,_this)=>{
     	    if(data.length==0){
     	    	    return base.returnjson(res,100,"用户不存在");
     	    }
            return base.returnjson(res,200,'查询成功',data[0]);
       	})
       .end();
};