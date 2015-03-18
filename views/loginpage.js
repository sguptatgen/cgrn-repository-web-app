
var path = require('path');
var db = require('./../db.js');

module.exports.get = function(req,res){
	res.sendFile(path.join(__dirname, '../templates', 'loginpage.html'));
}

module.exports.post = function(req,res){
	if(req.body.type === "login"){
		db.userData.find({email:req.body["login-email"],password:req.body["login-password"]}).toArray(function(err,docs){
			if(err) throw err;
			else if(!docs.length){
				res.send({error:"Incorrect email or password."});
			}
			else if(docs.length > 1){
				res.send({error:"Your password and email is the same as another members!"});
			}
			else {
				req.session.user = docs[0];
				db.userData.update({email:docs[0].email}, {$push:{logins: new Date().toISOString()}}, function(err, result){
					if(err) throw err;
					res.send({redirect:'/search'});
				});
			}
		});
	}
	else if(req.body.type === "register"){
		var newUserDoc = {email:req.body["login-email"], password:req.body["login-password"], name:{first:req.body["login-name"].split(" ")[0], last:req.body["login-name"].split(" ")[1]}, logins:[new Date().toISOString()]};
		db.userData.find({email:req.body["login-email"]}).toArray(function(err,docs){
			if (err) throw err;
			else if (docs.length) res.send({error: "You already have an account!"});
			else {
				db.userData.insert(newUserDoc,function(err,records){
					if(err) throw err;
					req.session.user = records[0];
					res.send({redirect:'/search'});
				});
			}
		});
	}
};
