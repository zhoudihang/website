//这个主要写公共底层
//
var fs = require('fs');
var multiparty = require('multiparty');
var util = require('util');
var crypto = require('crypto');
var sql = require('./mysql');
var com = require('./common');
var config = require('./config');
var formidable = require('formidable');
var nodemailer = require('nodemailer');

var base = {};

// 重定向显示错误提示页面
base.errorMsg=function(req,res,msg){
	   var url = '/errorMsg/'+msg;
	   res.redirect(302, url);  
}
base.toString = function(string){
   return (("`" + string +"`").indexOf("'")>-1?("`" + string +"`").replace(/\'/g,"\\'").replace(/`/g,"'"):("'" +string +"'"));
}
// 返回json字符串格式
base.returnjson=function(res,code,msg,result){
	  res.end(JSON.stringify({"code":code,"msg":msg,"result":result}));
}

// 去空格
base.trim=function(str){
	  return str.replace(/^(\s|\u00A0)+/,'').replace(/(\s|\u00A0)+$/,''); 
}


// 获取表单数据
// @params    obj=>{
//                  req:req,
//                  res:res,
//                  next:next,
//                  error:fn,
//                  success:fn
//            }
//            
base.getFormData=function(obj){
		 var form = new formidable.IncomingForm();  
		 form.parse(obj.req, function(err, fields, files) {  
		        if(err!=null){
	                 if(obj.error){
	                 	   obj.error();
	                 }
	                 return false;
		        }
		        obj.success(fields,files);
		        // console.log('fields',fields);//表单传递的input数据  
		        // console.log('files',files);//上传文件数据  
		 }); 
}

// 后台用户权限 permission
base.permission=function(req,res,next,userInfo){
         var originalUrl=(req._parsedOriginalUrl.pathname||'/admin'+(req._parsedUrl.pathname||req.route.path)).split('/');//检测路径
         var _this=this;
		  //         baseUrl: '/admin',
		  // originalUrl: '/admin/index',
	     if(req.session[userInfo].permission&&req.session[userInfo].permission.length!=0){
	     	   // next();
	     	   originalUrl_fn();
	     	   return false;
	     }
		req.session[userInfo].permission = [];

		let persql = 'SELECT p.*,r.name,r.description FROM z_permissions AS p LEFT JOIN z_role_permissions AS rp ON p.id = rp.per_id LEFT JOIN z_role AS r ON rp.role_id = r.id where p.register = 1 and r.register = 1 and r.id = (select role_id from z_user_role where register = 1 and user_id='+req.session[userInfo].id+')';
		let rqs = [
		      {
				   	sql:persql,
				    sCallback:(data,options) => {	
					   	      for(var i =0;i<data.length;i++){
					   	      	    data[i].router = '/'+data[i].module+'/'+data[i].controller+'/'+data[i].view;
					   	      	    req.session[userInfo].permission.push(data[i]);
					   	      }			
					   	      originalUrl_fn();	
				    }
			  }
		];
		sql.querysql({
			   sql:rqs,//如果这里eCallback没有传的话调默认eCallback
			   eCallback:(err,options)=>{
			   	    return  base.errorMsg(req,res,'查询失败');
			   	    options.end();
			   }
		})	
		// 检测权限(路径)
		function originalUrl_fn(){
			   var originalUrl_mcv = '';
			   if(originalUrl.length>3){  
		 	        originalUrl_mcv = '/'+originalUrl[1]+'/'+originalUrl[2]+'/'+originalUrl[3];
		 	        // var per_mcv='';
		 	        var _per = req.session[userInfo].permission ;
		 	        var through=false;//是否通过权限验证 	  	   	    
		 	   	    for(var i=0;i<_per.length;i++){
		                // per_mcv = '/'+_per[i].module+'/'+_per[i].controller+'/'+_per[i].view;
		 	   	        if( _per[i].router == originalUrl_mcv){
		                	    through=true; 
		                }
		 	   	    }
		 	   	    if(!through){
				 	   	    for(var i=0;i<_per.length;i++){
				 	   	        if( _per[i].router == originalUrl_mcv){
				                	    through=true; 
				                }
				 	   	    }
		 	   	    	  if(req.method.toUpperCase()=='POST'){
		 	   	    	  	   base.returnjson(res,'000','无权限访问!');
		 	   	    	  	   return false;
		 	   	    	  }
		 	   	    	  _this.errorMsg(req,res,'无权限访问!');
		 	   	    	  return false;
		 	   	    }
			   }
			   base.leftmenu(req,res,userInfo);
			   next();
		}
}

// 处理后台用户左菜单列表
base.leftmenu = (req,res,userInfo) => {
     let reqAdminUserInfo=req.session[userInfo];     
     if(!reqAdminUserInfo||!reqAdminUserInfo.permission){
          return false;
     }
     if(reqAdminUserInfo&&reqAdminUserInfo.leftmenu){
     	  return false;
     }

     let leftmenu = {};
     for(var i=0;i<reqAdminUserInfo.permission.length;i++){
            if(reqAdminUserInfo.permission[i].grade==1){
                 leftmenu[reqAdminUserInfo.permission[i].id] = reqAdminUserInfo.permission[i];
                 leftmenu[reqAdminUserInfo.permission[i].id].children=[];
            }
     }
     for(var i=0;i<reqAdminUserInfo.permission.length;i++){
            if(reqAdminUserInfo.permission[i].p_id!=0&&reqAdminUserInfo.permission[i].grade!=0){
                 leftmenu[reqAdminUserInfo.permission[i].p_id].children.push(reqAdminUserInfo.permission[i]);
            }
     }
     req.session[userInfo].leftmenu = leftmenu;
}

// 后台用户菜单列表
// @params type 1 一级菜单 2二级菜单 3 三级菜单
base.list=function(req,res,type){
         var list=[];
         var permission=req.session[__adminUserInfo__].permission;

         if(permission&&permission.length!=0){//设置显示权限
                for(var i=0;i<permission.length;i++){
                      if(permission[i].grade==type){
                            if(type==1){
		                            list.push({
		                                  url:'/'+permission[i].controller+'/'+permission[i].view,
		                                  title:permission[i].descript
		                            })
                            }else{
		                            list.push({
		                                  url:'/'+permission[i].view,
		                                  title:permission[i].descript
		                            })
                            }
                      }
                }
         }

        return list;
}

// 发送邮箱验证
// @params mailOptions 发送邮箱基本配置
base.sendMail=function(req,res,params){
        var email = config.email['aliyun'];
        var mailTransport = nodemailer.createTransport(email);
		var options = {
			        from        : email.auth.user,//'"你的名字" <你的邮箱地址>',
			        to          : params.email,//'"用户1" <邮箱地址1>, "用户2" <邮箱地址2>',
			        // cc         : ''  //抄送
			        // bcc      : ''    //密送
			        subject     :  params.subject?params.subject:config.website_name,
			        text        :  params.text?params.text:config.website_name,
			        html        :  params.html?params.html:'<h1>'+params.code+'</h1>',
			        // attachments : 
			        //             [
			        //                 {
			        //                     filename: 'img1.png',            // 改成你的附件名
			        //                     path: 'public/images/img1.png',  // 改成你的附件路径
			        //                     cid : '00000001'                 // cid可被邮件使用
			        //                 },
			        //                 {
			        //                     filename: 'img2.png',            // 改成你的附件名
			        //                     path: 'public/images/img2.png',  // 改成你的附件路径
			        //                     cid : '00000002'                 // cid可被邮件使用
			        //                 },
			        //             ]
		    };
		    mailTransport.sendMail(options, function(err, msg){
			        if(err){
			            res.end(base.returnjson(res,100,"发送失败!"));
			        }
			        else {
			        	
			            res.end(base.returnjson(res,200,"请去邮箱查看验证码！\n如果没接收到；请查看邮箱垃圾箱中有没有,并且添加修改为不是垃圾邮件"));
			        }
		    });
}

/*
	检测文件路径文件是否存在
	@params
	{
	  path: string 路径
	  isCreate:boolean 是否创建文件夹  默认不创建 false 创建 true,
	  end: function 结束回调函数 接收三个参数 （'isdir/ismkdir'【string】 ，isdir/ismkdir【boolean】，err） 
	                isdir => false 没有该文件夹，TRUE有该文件夹  ismkdir =》false 创建该文件夹失败 TRUE 创建该文件成功
	                err = > 错误信息

	}

	base.testdir(req,res,{
		path:'D:\\githud\\nodejs/public/arr/user_img/admin',
		isCreate:true,
		end:function(dir,bool){//（'isdir/ismkdir'【string】 ，isdir/ismkdir【boolean】）

		}
	})
*/
base.testdir = function(req,res,params){
	  var options = {};
      options.testdirpath = '';
      options.index = 0;
      // options.path = 'D:\\githud\\nodejs/public/arr/user_img/admin'.replace(/\/|\\/g,',').split(',');
      options.path = params.path.replace(/\/|\\/g,',').split(',');
      options.__ROOTDIR__ = global.__ROOTDIR__!=undefined?__ROOTDIR__:options.path[0]+'/'+options.path[1];
      options.__ROOTDIR__ = options.__ROOTDIR__.replace(/\/|\\/g,'/');

      options.for = function(){
	      	  options.testdirpath = '';
	      	  for(var i=0;i<options.path.length;i++){
		                if(i==0){
		                	 options.testdirpath = options.path[i];
		                }else{
		                	 options.testdirpath = options.testdirpath +'/'+ options.path[i];
		                }
		                if(arguments[0]==options.__ROOTDIR__){
				                options.index=i;
				                if(arguments[0]==options.__ROOTDIR__&&options.testdirpath==options.__ROOTDIR__){
			                          options.text(options.testdirpath)
			                          break;
				                }
		                }else if(i==options.index){
			                  break;
		                }
	      	  }
	      	  return options.testdirpath;
      }
      //回调
      options.endFn=function(oparams){
	           if(params.isCreate){
	           	        //创建
	                    if(oparams.bool&&(oparams.dir=='isdir'||oparams.dir=='ismkdir')){
                             options.index++;
                             if(options.index>=options.path.length){
                                   params.end(oparams.dir,oparams.bool,oparams.err);
                                   return false;
                             }
                             options.text(options.for());
	                    }else{
	                    	  //创建
	                    	  if(oparams.dir=='ismkdir'){
                                  params.end(oparams.dir,oparams.bool,oparams.err);
	                    	  }else{
	                    	  	  options.mkdir(oparams.path);
	                    	  }
	                    }
	           }else{
			            //不创建
			            if(params.end){
			            	  params.end(oparams.dir,oparams.bool,oparams.err);
			            }else{
			            	  res.end();
			            }
		       }
      }
      //创建文件/检测路径 回调
	  options.tmdircallback=function(err,dir){  
		          options.endFn({
		              	dir:dir,
		              	err:err,
		              	bool:err?false:true,
		              	index:options.index,
		              	path:options.testdirpath
		          });
	  }

      //创建文件
      options.mkdir=function(path){
		   	   fs.mkdir(path,function(err){
                    // if(err){
                    // 	  // console.log('文件夹创建失败');
                    // }else{
                    // 	  // console.log('文件夹已经创建成功');
                    // }
                    options.tmdircallback(err,'ismkdir')
		   	   })
      }

      // 检测路径
      options.text = function(testPath){
		      fs.access(testPath,(err) => {
				       // console.log(err ? 'no access!' : 'can read/write');
					   // if(err){
					   // 	      // console.log('文件不存在');
					   // }else{
						  //  	  // console.log('文件已存在');
					   // }
					   options.tmdircallback(err,'isdir');
			  }) 
      }
      
      options.for(options.__ROOTDIR__);

}

// 上传图片
// 这个文件上传主要针对layui富文本
// @params multiparty params 上传图片基本配置
// params{
//     path:path上传目标路径 
//     uploadError:function(err){}//上传失败
//     renameError:function(err){}//重命名失败
//     endCallback:function(err){}//最后回调
// }
base.UploadImages=function(req,res,params){

      // 主要是检测有没有这个文件夹；如果没有就创建；
      var loadPath = global.__ROOTDIR__+'/'+params.path;
      // console.log(loadPath);

	  base.testdir(req,res,{
		  	path:loadPath,
		  	isCreate:true,
		  	end:function(dir,bool){//（'isdir/ismkdir'【string】 ，isdir/ismkdir【boolean】,err）
                if(!bool){
                	    return res.end(JSON.stringify({"code": 100,"msg": "修改失败",'failMsg':'文件夹创建失败'}));
                }else{
                	    uploadImg()
                }
		  	}
	  })

      // 
      function uploadImg(){
		        //生成multiparty对象，并配置上传目标路径
		        //fileName:fileName 上传后重命名（暂时不做）
		        // console.log(params)
		        var form = new multiparty.Form({uploadDir: params.path});
		        //上传完成后处理
		        form.parse(req, function(err, fields, files) {
		        	// console.log(files);
                          var filesTmp = JSON.stringify(files,null,2);
				          // var suffix_name = files.file[0].headers['content-type'].split('image/')[1];
				          if(err){
				                // console.log('parse error: ' + err);
				                if(params.uploadError){
				                	   params.uploadError(err);
				                }
				          }
				          if(params.endCallback){
				          	     // console.log(files);
				          	     params.endCallback(files);
				          }else{
				          	     res.end();
				          }			      
                });
      }
}

module.exports = base;
