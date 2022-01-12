// 文档加载完毕后执行
$(document).ready(function ()
{
    //根据屏幕大小计算字体大小
    const oHtml = document.getElementsByTagName('html')[0]
    const width = oHtml.clientWidth;
    var rootFontSize = 12 * (width / 1440);// 在1440px的屏幕基准像素为12px
    rootFontSize = rootFontSize <9 ? 9:rootFontSize;//最小为8px
    oHtml.style.fontSize = rootFontSize+ "px";
    //设置正文部分宽度
    galleryWidth = width;//占比100%
    galleryHeight = 9*galleryWidth/16;//宽高比为16:9
    $("#main").width(galleryWidth);
    //处理参数
    var args = getQuery();
    var category = args["category"]; //当前目录
    var id = args["id"];//当前board id

    from = args["from"]?args["from"]:"mp";//可能为groupmessage,timeline等
    fromUser = args["fromUser"]?args["fromUser"]:"";//从连接中获取分享用户ID
    fromBroker = args["fromBroker"]?args["fromBroker"]:"";//从连接中获取分享达人ID。重要：将依据此进行收益计算
    boardType = args["type"]?args["type"]:"board2-waterfall";//从连接中获取清单类型，默认为waterfall

    posterId = args["posterId"]?args["posterId"]:null;//从连接中获取海报ID，默认为空。如果没有则跳转到默认海报生成

    //生成二维码：需要提前生成，避免时延导致显示不完整
    //generateQRcode();//在加载达人信息后显示，需要将达人ID写入URL

    //加载内容
    loadBoard(id); 
    //加载清单item列表
    loadBoardItems(id);
    
});

util.getUserInfo();//从本地加载cookie

//使用代理避免跨域问题。后端将代理到指定的URL地址。注意：使用https
var imgPrefix = "https://www.biglistoflittlethings.com/3rdparty?url=";

//分享清单格式：board2、board2-waterfall
var boardType = "board2-waterfall";//默认为图片流

//临时用户
var tmpUser = "";

var items = [];//board item 列表
var totalItems = 0;// 记录总共的item条数，由于是异步处理，需要对数量进行控制，避免数量过少时不能生成海报

var columnWidth = 800;//默认宽度600px
var columnMargin = 5;//默认留白5px
var galleryWidth = 672;
var galleryHeight = 378;
var num = 1;//需要加载的内容下标

//记录分享用户、分享达人
var from = "mp";//链接来源，默认为公众号进入
var fromUser = "";
var fromBroker = "";
var broker = {};//当前达人
var board = {};//当前board

var posterId = null;//海报scheme
var brokerQrcode = null;//存放达人二维码url

//生成短连接及二维码
function generateQRcode(){
    var longUrl = window.location.href.replace(/board2ext/g,boardType).replace(/fromBroker/g,"fromBrokerOrigin").replace(/fromUser/g,"fromUserOrigin");//获取分享目标链接
    //添加分享达人及分享用户
    if(broker && broker.id)    
        longUrl += "&fromBroker="+broker.id;
    longUrl += "&fromUser="+(app.globalData.userInfo._key?app.globalData.userInfo._key:"");
    var header={
        "Content-Type":"application/json"
    };
    util.AJAX(app.config.auth_api+"/wechat/ilife/short-url", function (res) {
        console.log("generate short url.",res);
        var shortUrl = longUrl;
        if (res.status) {//获取短连接
            shortUrl = res.data.url;
        }
        //bug修复：qrcode在生成二维码时，如果链接长度是192-217之间会导致无法生成，需要手动补齐
        if(shortUrl.length>=192 && shortUrl.length <=217){
            shortUrl += "&placehold=fix-qrcode-bug-url-between-192-217";
        }
        console.log("generate qrcode by short url.[length]"+shortUrl.length,shortUrl);
        var qrcode = new QRCode("app-qrcode-box");
        qrcode.makeCode(shortUrl);
        setTimeout(uploadPngFile,300);//需要图片装载完成后才能获取
    }, "POST", { "longUrl": longUrl },header);  
}

//上传二维码到poster服务器，便于生成使用
function uploadPngFile(dataurl, filename){
    dataurl = $("#app-qrcode-box img").attr("src");
    filename = "broker-qrcode-"+broker.id+".png";
    console.log("try to upload qrcode.",dataurl,filename);
    var formData = new FormData();
    formData.append("file", dataURLtoFile(dataurl, filename));//注意，使用files作为字段名
    $.ajax({
         type:'POST',
         url:app.config.poster_api+"/api/upload",
         data:formData,
         contentType:false,
         processData:false,//必须设置为false，不然不行
         dataType:"json",
         mimeType:"multipart/form-data",
         success:function(data){//把返回的数据更新到item
            console.log("qrcode file uploaded. try to update item info.",data);
            if(data.code ==0 && data.url.length>0 ){//仅在成功返回后才操作
                brokerQrcode = data.url;
                console.log("qrcode image.[url]"+app.config.poster_api+"/"+data.url);
                //生成海报
                requestPosterScheme();//全部加载完成后显示海报
            }
         }
     }); 
}

//转换base64为png文件
function dataURLtoFile(dataurl, filename) {
  // 获取到base64编码
  const arr = dataurl.split(',')
  // 将base64编码转为字符串
  const bstr = window.atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n) // 创建初始化为0的，包含length个元素的无符号整型数组
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new File([u8arr], filename, {
    type: 'image/png',//固定为png格式
  })
}

//根据openid查询加载broker
function loadBrokerByOpenid(openid) {
    console.log("try to load broker info by openid.[openid]",openid);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/brokerByOpenid/"+openid, function (res) {
        console.log("load broker info.",openid,res);
        if (res.status) {//将佣金信息显示到页面
            broker = res.data;
            $("#author").html(broker.name);    //如果当前用户是达人，则转为其个人board
            $("#broker-name").html(broker.name+ " 推荐");    //如果当前用户是达人，则显示当前用户
            //生成达人推广二维码
            generateQRcode();
        }
        //加载达人后再注册分享事件：此处是二次注册，避免达人信息丢失。
        registerShareHandler();
    });
}

//根据boardId查询board信息
function loadBoard(boardId){
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    };     
    util.AJAX(app.config.sx_api+"/mod/board/rest/board/"+boardId, function (res) {
        console.log("Board::loadBoard load board successfully.", res)
        if(res.status){
            console.log("Board::loadBoard now insert board info.", res)
            board = res.data;          

            //准备注册分享事件。需要等待内容加载完成后才注册
            //判断是否为已注册用户
            if(app.globalData.userInfo&&app.globalData.userInfo._key){//表示是已注册用户
                loadBrokerByOpenid(app.globalData.userInfo._key);
                //注意：在加载完成后会注册分享事件，并用相应的broker进行填充
            }else{//直接注册分享分享事件，默认broker为system，默认fromUser为system
                console.log("cannot get user info. assume he is a new one.");
                //TODO:是不是要生成一个特定的编号用于识别当前用户？在注册后可以与openid对应上
                //检查cookie是否有标记，否则生成标记
                tmpUser = $.cookie('tmpUserId');
                if(tmpUser && tmpUser.trim().length>0){
                    console.log("there already has a temp code for this user.", tmpUser);
                }else{
                    tmpUser = "tmp-"+gethashcode();
                    console.log("there is no temp code for this user, generate one.", tmpUser);
                    $.cookie('tmpUserId', tmpUser, { expires: 3650, path: '/' });  
                }
                registerShareHandler();
            } 

        }
    }, "GET",{},header);
}


//根据boardId查询所有item列表
function loadBoardItems(boardId){
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    };     
    util.AJAX(app.config.sx_api+"/mod/boardItem/rest/board-items/"+boardId, function (res) {
        console.log("Board::loadBoardItems load board items successfully.", res)
        //装载具体条目
        var hits = res&&res.length>5?res.slice(0,5):res;//如果大于5则仅取5条
        totalItems = hits.length;
        console.log("Board::loadBoardItems prepare post items.", hits)
        for(var i = 0 ; i < hits.length; i++){ //限定最多5条
            loadBoardItem(hits[i]);//查询具体的item条目
        }        
        //insertBoardItem(); //显示到界面:注意需要将加载过程变为同步，否则会导致数据缺失
    }, "GET",{},header);
}


function loadBoardItem(item){//获取内容列表
    $.ajax({
        url:"https://data.shouxinjk.net/_db/sea/my/stuff/"+item.item,
        type:"get",
        //async: false,//通过记录已加载stuff数目进行控制，通过异步调用
        data:{},
        success:function(data){
            item.stuff = data;//装载stuff到boarditem   
            items.push(item); //装载到列表 
            totalItems--;//记录已加载的详细条目数量
            requestPosterScheme();//请求生成海报：会判断是否已经加载完成
        }
    })            
}

//生成商品海报：先获得海报列表
//TODO：当前是从所有列表中过滤，需要调整为根据ID获取海报scheme
function requestPosterScheme(){
    if(totalItems>0 || !brokerQrcode){
        console.log("poster is not ready....wait....");
        return;
    }
    console.log("poster ready....try to generate....");
    $.ajax({
        url:app.config.sx_api+"/mod/posterTemplate/rest/board-templates",
        type:"get",
        data:{},
        success:function(schemes){
            console.log("\n===got item poster scheme ===\n",schemes);
            //遍历海报并生成
            for(var i=0;i<schemes.length;i++){
               //遍历模板：找到匹配的模板项
                for(var i=0;i<schemes.length;i++){
                    if(posterId == schemes[i].id){
                        requestPoster(schemes[i]);
                        break;//找到就结束
                    }
                }
                console.log("cannot find poster scheme by id.[id]"+posterId);
            }
        }
    });  
}

//生成海报，返回海报图片URL
//注意：海报模板中适用条件及参数仅能引用这三个参数
function requestPoster(scheme,xBroker,xItem,xUser){
    //判断海报模板是否匹配当前条目：
    var isOk = true;
    if(scheme.condition && scheme.condition.length>0){//如果设置了适用条件则进行判断
        try{
            isOk = eval(scheme.condition);
        }catch(err){
            console.log("\n=== eval poster condition error===\n",err);
        }
    }
    if(!isOk){//如果不满足则直接跳过
        console.log("condition not satisifed. ignore.");
        return;       
    }

    //准备海报参数
    try{
        eval(scheme.options);//注意：脚本中必须使用 var xParam = {}形式赋值
    }catch(err){
        console.log("\n=== eval poster options error===\n",err);
        return;//这里出错了就别玩了
    }
    console.log("\n===eval poster options===\n",xParam);
    var options = {//merge参数配置
                  ...app.config.poster_options,//静态参数：accessKey、accessSecret信息
                  ...xParam //动态参数：配置时定义
                }
    console.log("\n===start request poster with options===\n",options);
    //请求生成海报
    $.ajax({
        url:"https://poster.biglistoflittlethings.com/api/link",
        type:"post",
        data:JSON.stringify(options),
        success:function(res){
            console.log("\n===got item poster info ===\n",res);
            //将海报信息更新到stuff
            if(res.code==0 && res.url && res.url.length>0){
                //显示到界面
                $("#poster").empty();//清空
                $("#poster").append("<img style='object-fill:cover;width:100%' src='"+res.url+"'/>");
                $("#share-img-tips").css("display","block"); 
                $("#post-mask").css("display","none"); 
                $("#generate-link").css("display","block"); 
            }
        }
    });     
}

function registerShareHandler(){
    //计算分享达人：如果当前用户为达人则使用其自身ID，如果当前用户不是达人则使用页面本身的fromBroker，如果fromBroker为空则默认为system
    var shareBrokerId = "system";//默认为平台直接分享
    if(broker&&broker.id){//如果当前分享用户本身是达人，则直接引用其自身ID
        shareBrokerId=broker.id;
    }else if(fromBroker && fromBroker.trim().length>0){//如果当前用户不是达人，但页面带有前述达人，则使用前述达人ID
        shareBrokerId=fromBroker;
    }
    //计算分享用户：如果是注册用户则使用当前用户，否则默认为平台用户
    var shareUserId = "system";//默认为平台直接分享
    if(tmpUser&&tmpUser.trim().length>0){//如果是临时用户进行记录。注意有时序关系，需要放在用户信息检查之前。
        shareUserId = tmpUser;
    }
    if(app.globalData.userInfo && app.globalData.userInfo._key){//如果为注册用户，则使用当前用户
        shareUserId = app.globalData.userInfo._key;
    }

    //准备分享url，需要增加分享的 fromUser、fromBroker信息
    var shareUrl = window.location.href.replace(/board2/g,"share");//需要使用中间页进行跳转
    if(shareUrl.indexOf("?")>0){//如果本身带有参数，则加入到尾部
        shareUrl += "&fromUser="+shareUserId;
        shareUrl += "&fromBroker="+shareBrokerId;
    }else{//否则作为第一个参数增加
        shareUrl += "?fromUser="+shareUserId;
        shareUrl += "&fromBroker="+shareBrokerId;        
    }
    shareUrl += "&origin=board";//添加源，表示是一个列表页分享

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
                   // 'onMenuShareTimeline', 'onMenuShareAppMessage','onMenuShareQQ', 'onMenuShareWeibo', 'onMenuShareQZone',
                  'updateAppMessageShareData',
                  'updateTimelineShareData',
                  'onMenuShareAppMessage',
                  'onMenuShareTimeline',
                  'chooseWXPay',
                  'showOptionMenu',
                  "hideMenuItems",
                  "showMenuItems",
                  "onMenuShareTimeline",
                  'onMenuShareAppMessage'                   
                ] // 必填，需要使用的JS接口列表
            });
            wx.ready(function() {
                // config信息验证后会执行ready方法，所有接口调用都必须在config接口获得结果之后，config是一个客户端的异步操作，所以如果需要在页面加载时就调用相关接口，
                // 则须把相关接口放在ready函数中调用来确保正确执行。对于用户触发时才调用的接口，则可以直接调用，不需要放在ready函数中。
                //分享到朋友圈
                wx.onMenuShareTimeline({
                    title:board&&board.title?board.title:"小确幸，大生活", // 分享标题
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl:board.logo?board.logo:"http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg", // 分享图标
                    success: function () {
                        // 用户点击了分享后执行的回调函数
                        //TODO: board分享当前不记录
                        /*
                        logstash(stuff,"mp","share timeline",shareUserId,shareBrokerId,function(res){
                            console.log("分享到朋友圈",res);
                        }); 
                        //**/
                    },
                });
                //分享给朋友
                wx.onMenuShareAppMessage({
                    title:board&&board.title?board.title:"小确幸，大生活", // 分享标题
                    desc:board.description&&board.description.trim().length>0?board.description.replace(/<br\/>/g,""):"Live is all about having a good time.", // 分享描述
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl: board.logo?board.logo:"http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg", // 分享图标
                    type: 'link', // 分享类型,music、video或link，不填默认为link
                    dataUrl: '', // 如果type是music或video，则要提供数据链接，默认为空
                    success: function () {
                      // 用户点击了分享后执行的回调函数
                      //TODO:board分享当前不记录
                      /**
                        logstash(stuff,"mp","share appmsg",shareUserId,shareBrokerId,function(res){
                            console.log("分享到微信",res);
                        }); 
                        //**/
                    }
                });            
            });
        }
    })    
}
