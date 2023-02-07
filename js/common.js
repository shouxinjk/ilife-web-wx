//显示顶部用户信息
function insertPerson(person){
    // 显示HTML
    var html = '';
    html += '<div class="info-general">';
    html += '<img class="general-icon" src="'+person.avatarUrl+'" height="60px"/>';
    html += '</div>';
    html += '<div class="info-detail">';
    html += '<div class="info-text info-blank">'+person.nickName+'</div>';
    html += '<div class="info-text info-blank tipform" id="brokerHint" data-type="badge" style="display:flex;flex-direction:row;align-items:center;flex-wrap:nowrap;">'+(person.province?person.province:"")+(person.city?(" "+person.city):"")+'</div>';
    html += '<div class="info-text info-blank" id="brokerLink" style="display:flex;flex-direction:row;">让小确幸填满你的大生活</div>';
    html += '<div style="position:absolute;right:5px;top:5px;"><a href="task.html" style="color:silver;font-size:10px;">帮助</a></div>';
    html += '</div>';
    $("#user").append(html);
    //同时更新broker的nickname及avatarUrl：由于微信不能静默获取，导致broker内缺乏nickname及avatarUrl
    console.log("try to sync broker info.",person);
    $.ajax({
        url:app.config.sx_api+"/mod/broker/rest/sync/"+person._key,
        type:"post",
        data:JSON.stringify({
            nickname: person.nickName,
            avatarUrl:person.avatarUrl
        }),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },
        success:function(res){
            console.log("sync success.",res);
        },
        error:function(){
            console.log("sync failed.",person);
        }
    });     
}

//更新达人信息：显示达人后台入口
/**
function insertBroker(broker){
    $("#brokerLink").html('<a href="broker/selection.html">生活家后台</a>&nbsp;&nbsp;<a href="publisher/articles.html">流量主后台</a>');
    $("#brokerHint").html("达人级别："+broker.level);
}
//**/

//查询用户徽章：当前方式为根据用户等级显示徽章列表，以高级用户为分界线，低于高级用户显示用户徽章，高于高级用户显示达人徽章
function loadBadges(broker) {
    console.log("try to load badges.");
    util.AJAX(app.config.sx_api+"/mod/badge/rest/badges", function (res) {
        console.log("load broker badges.",res);
        //装载到达人徽章
        if(broker && broker.level>3){ //生活家及以上
            for(var i=3;i<=broker.level && i<res.length;i++){
                if( (res[i].key=="broker" && broker.badges.find(item => item.badge.key == "broker_pro")) //是broker，且是broker_pro
                    || (res[i].key=="tailor" && broker.badges.find(item => item.badge.key == "tailor_pro"))  //是tailor，且是tailor_pro
                    || (res[i].key=="broker_pro" && !broker.badges.find(item => item.badge.key == "broker_pro"))   //是broker_pro，需要同时检查授权
                    || (res[i].key=="tailor_pro" && !broker.badges.find(item => item.badge.key == "tailor_pro"))   //是tailor_pro，需要同时检查授权
                ){
                    continue; //不显示，在下一个等级显示
                }else{
                    showBadge(res[i]);                                
                }
            }
        }else if(broker && broker.level<=3){ //已注册达人，但等级低于生活家：在取消关注后等级被取消，重新关注后将出现此情况
            for(var i=0;i<=broker.level && i<res.length;i++){
                showBadge(res[i]);
            }            
        }else{ //普通用户：根据用户等级显示
            if(app.globalData.userInfo && app.globalData.userInfo.level){ //用户等级都<=3
                for(var i=0;i<=app.globalData.userInfo.level && i<res.length;i++){
                    showBadge(res[i]);
                }                
            }else{ //如果没有则仅显示用于勋章
                showBadge(res[0]);
            }
        }
        //装载徽章列表，用于展示
        showBadgeList(broker, res);
    });
}
//显示单个badge到达人徽章列表
function showBadge(badge){
    //徽章
    var badgesHtml = "";
    badgesHtml += "<div style='min-width:32px;display:flex;flex-direction:column;align-items:center;margin:0 2px;'>";
    badgesHtml += "<div><img src='images/badge/"+(badge.icon?badge.icon:(badge.key+".png"))+"' style='width:32px;height:32px;object-fit:cover;'/></div>";
    badgesHtml += "<div style='text-align:center;font-size:9px;color:#fff;'><span>"+badge.name+"</span></div>";
    badgesHtml += "</div>";

    $("#brokerHint").append(badgesHtml);
}

//显示所有徽章列表，其中未获取的灰度显示
var badgeTpl = `
    <div style="display:flex;flex-direction:row;flex-wrap:nowrap;justify-content:center;align-items:center;">
        <div style="width:15%;text-align:center;">
            <img src="images/badge/__key.png" style="width:48px;height:48px;__greyscale"/>
        </div>
        <div style="width:85%;">
            <div style="font-size:12px; font-weight:bold;line-height:14px;text-align:left;">
                __name
            </div>
            <div style="font-size:10px;font-weight:normal;line-height:12px;text-align:left;">
                __desc
            </div>         
        </div>        
    </div>
`;
function showBadgeList(broker, badges){
    badges.forEach(function(badge){
        var greyscale = "filter: grayscale(100%);"
        var got = "";
        if( broker.level>= badge.level ){ //已获得的显示图标
            //对于生活家+ 定制师+需要特殊判断
            if( (badge.key=="broker_pro" && !broker.badges.find(item => item.badge.key == "broker_pro"))   //是broker_pro，需要同时检查授权
                || (badge.key=="tailor_pro" && !broker.badges.find(item => item.badge.key == "tailor_pro"))   //是tailor_pro，需要同时检查授权
            ){
                //如果未在授权列表里，则显示未获取
            }else{
                greyscale = "";
                got = "✅";                               
            }            
        }     
        var html  = badgeTpl.replace(/__greyscale/g,greyscale).replace(/__key/g,badge.key).replace(/__name/g,got+badge.name).replace(/__desc/g,badge.description)
        $("#badgeList").append(html);
    });
}

//对于达人显示勋章及贡献度
function insertBroker(broker){

    //徽章
    loadBadges(broker);

    //贡献度
    $("#brokerLink").empty();
    $("#brokerLink").append('<div data-type="credit" class="tipform" style="border:1px solid #E5F0FC;background-color:#E5F0FC;color:#3070E8;font-size:10px;font-weight:bold;border-radius:10px;padding:2px 5px;display:flex;justify-content:center;align-items:center;"><div><img src="images/icon/points.png" style="width:12px;height:12px;object-fit:cover;"/></div>&nbsp;<div id="sxCredit">贡献度 : '+(broker.points&&broker.points>0?broker.points:0)+'</div></div>');

    //收益
    $("#brokerLink").append('&nbsp;<div data-type="money" class="tipform" style="border:1px solid #f6d0ca;background-color:#f6d0ca;color:#b80010;font-size:10px;font-weight:bold;border-radius:10px;padding:2px 5px;display:flex;justify-content:center;align-items:center;"><div><img src="images/icon/coins.png" style="width:12px;height:12px;object-fit:cover;"/></div>&nbsp;<div id="totalMoney">总收益 : 0</div></div>');
    getMoney(broker.id); 

    //注册事件：提示表单事件
    $(".tipform").click(function(){
        var eleId = '#'+$(this).data("type")+"form";
        console.log("try show tip form.",eleId);
        //显示表单
        $.blockUI({ message: $(eleId),
            css:{ 
                padding:        10, 
                margin:         0, 
                width:          '80%', 
                top:            '15%', 
                left:           '10%', 
                textAlign:      'center', 
                color:          '#000', 
                border:         '1px solid silver', 
                backgroundColor:'#fff', 
                cursor:         'normal' 
            },
            overlayCSS:  { 
                backgroundColor: '#000', 
                opacity:         0.7, 
                cursor:          'normal' 
            }
        });         
    });

    //解锁可用区域按钮
    var locks = {"broker":4,"tailor":6,"expert":8,"scholar":9};
    Object.keys(locks).forEach(function(lock){
        if((broker.badges && broker.badges.find(item => item.badge.key == lock))||( broker.level>=locks[lock])){ //有勋章
            console.log("check badge.",lock,broker.badges);
            $("#"+lock+"Btns").css("display","flex");
            $("#"+lock+"Tips").css("display","none");
            $("#"+lock+"JoinBtn").css("display","none");
            //对于生活家和定制师需要提供充值升级能力
            if( (lock=="broker" &&  !broker.badges.find(item => item.badge.key == "broker_pro")) //是broker，但不是broker_pro
                || (lock=="tailor"  &&  !broker.badges.find(item => item.badge.key == "tailor_pro")) ){ //是tailor，但不是tailor_pro
                $("#"+lock+"JoinBtn").data("action","upgrade");
                $("#"+lock+"JoinBtn>span").html("升级");
                $("#"+lock+"JoinBtn").css("display","block");
            }
        }else{
            $("#"+lock+"Btns").css("display","none");
            $("#"+lock+"Tips").css("display","block");    
            $("#"+lock+"JoinBtn").css("display","block");        
        }
    });      
}

//查询达人收益
function getMoney(brokerId) {
    console.log("try to load broker money info by brokerId.",brokerId);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/money/"+brokerId, function (res) {
        console.log("load broker money info.",brokerId,res);
        $("#totalMoney").empty();
        $("#totalMoney").append("总收益："+Number(res.totalAmount.toFixed(1)));
    });
}


//加载充值产品列表
function loadPointProducts(){
    $.ajax({
        url:app.config.sx_api+"/wx/wxPoints/rest/all",
        type:"get",        
        success:function(res){
            console.log("got available point products.",res);
            showPointProducts(res);
        }
    }) 
}

//将阅豆产品显示到界面供选择
//选择后触发充值。充值完成后返回
var selectedPointProduct = null;
function showPointProducts(products){
    $("#chargeDiv").empty();//先清空已有列表
    //逐条显示阅豆产品
    products.forEach(function(item){
        var html = "<div class='poor-topping-block poor-topping-enabled' id='product"+item.id+"' data-name='"+item.name+"' data-price='"+item.price+"' data-points='"+item.points+"'>"
        +"<div class='poor-topping-name'>"+item.name+"</div>"
        +"<div class='poor-topping-price'>￥"+(item.price/100)+"</div>"
        +"</div>";
        $("#chargeDiv").append(html);

        $("#product"+item.id).click(function(){
            selectedPointProduct = $(this).attr("id").replace(/product/,"");
            createPayInfo2({
                name:$(this).attr("data-name"),
                price:$(this).attr("data-price"),
                points:$(this).attr("data-points"),
                id:selectedPointProduct
            });           
        });
    });

    //显示充值表单
    $.blockUI({ message: $('#chargeForm'),
        css:{ 
            padding:        10, 
            margin:         0, 
            width:          '80%', 
            top:            '10%', 
            left:           '10%', 
            textAlign:      'center', 
            color:          '#000', 
            border:         '1px solid silver', 
            backgroundColor:'#fff', 
            cursor:         'normal' 
        },
        overlayCSS:  { 
            backgroundColor: '#000', 
            opacity:         0.7, 
            cursor:          'normal' 
        }
    });    
}


//下单：通过后台生成支付预订单，在获取prepay_id后调用js支付
var out_trade_no = null;
function createPayInfo2(pointProduct){
    out_trade_no = "ppt"+hex_md5(userInfo._key+"points"+pointProduct.id+(new Date().getTime())).substr(3);//表示购买广告: 总长度32位， 前三位pad为购买广告，前三位ppt为购买阅豆
    $.ajax({
        url:app.config.sx_api+"/wxPay/rest/payinfo",
        type:"post", 
        data:JSON.stringify({
            openid:userInfo._key,
            out_trade_no:out_trade_no,
            total_fee:Number(pointProduct.price),//*100,//单位为分
            body:"充值",
            trade_type:"JSAPI",
            spbill_create_ip:""//returnCitySN.cip//查询得到本机ip地址

        }),    
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },             
        success:function(res){
            console.log("got wechat payinfo.",res);
            if(res.success){
                console.log("try to start wechat pay.",res);
                payOrder2(res.data);
            }
        }
    });
}

//支付：发起微信支付提交购买。支付成功后创建购买记录
function payOrder2(payInfo){
    console.log("start wx pay",payInfo);
    $.ajax({
        url:app.config.auth_api+"/wechat/jssdk/ticket",
        type:"get",
        data:{url:window.location.href},//重要：获取jssdk ticket的URL必须和浏览器浏览地址保持一致！！
        success:function(json){
            console.log("===got jssdk ticket===\n",json);
            wx.config({
                debug:false, // 开启调试模式,调用的所有api的返回值会在客户端alert出来，若要查看传入的参数，可以在pc端打开，参数信息会通过log打出，仅在pc端时才会打印。
                appId: json.appId, // 必填，公众号的唯一标识
                timestamp:json.timestamp , // 必填，生成签名的时间戳
                nonceStr: json.nonceStr, // 必填，生成签名的随机串
                signature: json.signature,// 必填，签名
                jsApiList: [
                  'chooseWXPay',                
                ] // 必填，需要使用的JS接口列表
            });
            wx.ready(function() {
                // config信息验证后会执行ready方法，所有接口调用都必须在config接口获得结果之后，config是一个客户端的异步操作，所以如果需要在页面加载时就调用相关接口，
                // 则须把相关接口放在ready函数中调用来确保正确执行。对于用户触发时才调用的接口，则可以直接调用，不需要放在ready函数中。
                console.log("before wx.chooseWXPay. payInfo.",payInfo);
                wx.chooseWXPay({
                  timestamp: payInfo.timeStamp, // 支付签名时间戳，注意微信jssdk中的所有使用timestamp字段均为小写。但最新版的支付后台生成签名使用的timeStamp字段名需大写其中的S字符
                  nonceStr: payInfo.nonceStr, // 支付签名随机串，不长于 32 位
                  package: payInfo.package, // 统一支付接口返回的prepay_id参数值，提交格式如：prepay_id=\*\*\*）
                  signType: 'MD5', // 微信支付V3的传入RSA,微信支付V2的传入格式与V2统一下单的签名格式保持一致
                  paySign: payInfo.paySign, // 支付签名
                  success: function (res) {
                    // 支付成功后的回调函数
                    console.log("wechat pay finished.",res);    
                    if(res.errMsg == "chooseWXPay:ok"){//注意：支付完成后仅返回状态，无transaction_id、out_trade_no等。需要手动补全，并由后台更新订单状态
                        purchasePoints(res);
                    }else{
                        siiimpleToast.message('未能成功支付，请重新尝试。',{
                          position: 'bottom|center',
                          delay: 1000
                        });
                    }          
                  },
                  cancel: function (err) {
                    // 用户取消支付
                    console.log("cancel pay",err);
                    siiimpleToast.message('支付已取消，请重新尝试。',{
                      position: 'bottom|center',
                      delay: 1000
                    });
                  },
                  fail: function (res) {
                    // 支付失败
                    console.log("pay fail.",res);
                    siiimpleToast.message('支付失败，请重新尝试。',{
                      position: 'bottom|center',
                      delay: 1000
                    });            
                  }
                });          
            });
            wx.error(function(res){
              // config信息验证失败会执行error函数，如签名过期导致验证失败，具体错误信息可以打开config的debug模式查看，也可以在返回的res参数中查看，对于SPA可以在这里更新签名。
              console.log("wx.error ",res);
            });
        }
    })  
}


//完成充值：仅在支付成功后提交。其他不做考虑：如果支付取消，或中途退出？？
//提交数据包括：达人ID或达人openid，阅豆产品
function purchasePoints(wxPayResult){
    //提交购买记录
    $.ajax({
        url:app.config.sx_api+"/wx/wxPaymentPoint/rest/purchase",
        type:"post", 
        data:JSON.stringify({
            productId:selectedPointProduct,
            brokerId:broker&&broker.id?broker.id:"",//brokerId与brokerOpenid至少传递一个
            brokerOpenid:userInfo._key,
            out_trade_no:out_trade_no,//直接用前台组织的out_trade_no
            result_code:wxPayResult.errMsg //errMsg即为状态码
        }),    
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },             
        success:function(res){
            console.log("points purchased.",res);
            $.unblockUI(); 
            if(res.success){//不处理重复购买的情况
                siiimpleToast.message('充值已成功，'+res.data.points.points+'体验次数已到账~~',{
                      position: 'bottom|center'
                    });  
                //更新到界面 
                if(broker&&broker.points){
                    broker.points = broker.points + res.data.points.points;
                    //insertBroker(broker);
                $("#sxCredit").empty();
                $("#sxCredit").append("贡献度："+(broker.points>0?broker.points:0));                 
                }             
            }
        }
    });
}

//生成UUID
function getUUID() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

//生成短码
function generateShortCode(url){
    var chars = "0123456789abcdefghigklmnopqrstuvwxyzABCDEFGHIGKLMNOPQRSTUVWXYZ".split("");
    var hashCode = hex_md5(url);//根据原始URL等到hash
    var codeArray = [];
    for(var i=0;i<4;i++){//将hash值分解为4段，分别处理
        var subStr = hashCode.substr(i*8,8);
        //console.log("try generate hash code.",hashCode,subStr);
        var subHexNumber = 0x3FFFFFFF & parseInt(subStr,16);//得到前30位
        var outChars = "";
        for(var j=0;j<6;j++){//循环获得每组6位的字符串
            var index = 0x0000003D & subHexNumber;
            outChars += chars[index];
            subHexNumber = subHexNumber>>5;//每次移动5位
        }
        codeArray.push(outChars);
    }
    console.log("got short codes.",codeArray);
    return codeArray[new Date().getTime()%4];//随机返回一个
}

//存储短码到数据库
function saveShortCode(eventId, itemKey, fromBroker, fromUser, channel, longUrl, shortCode){
  var q = "insert into ilife.urls values ('"+eventId+"','"+itemKey+"','"+fromBroker+"','"+fromUser+"','"+channel+"','"+longUrl+"','"+shortCode+"',now())";
  console.log("try to save short code.",q);
  jQuery.ajax({
    url:app.config.analyze_api+"?query="+q,
    type:"post",
    //data:{},
    headers:{
      "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
    },         
    success:function(json){
      console.log("===short code saved.===\n",json);
    }
  });    
}