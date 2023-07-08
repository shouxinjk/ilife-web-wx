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
    id = args["id"];//当前内容

    from = args["from"]?args["from"]:"mp";//可能为groupmessage,timeline等
    fromUser = args["fromUser"]?args["fromUser"]:"";//从连接中获取分享用户ID
    fromBroker = args["fromBroker"]?args["fromBroker"]:"";//从连接中获取分享达人ID。重要：将依据此进行收益计算

    posterId = args["posterId"]?args["posterId"]:null;//从连接中获取海报ID，默认为空。如果没有则跳转到默认海报生成
    templateId = posterId;//设置为与posterId一致

    $("#generate-link").click(function(){
        window.location.href = window.location.href;//重新生成
    });

    //加载内容
    loadItem(id); 
    
    //请求所有模板列表。请求完成后将触发生成
    requestViewTemplates();

});

util.getUserInfo();//从本地加载cookie

//使用代理避免跨域问题。后端将代理到指定的URL地址。使用https
var imgPrefix = "https://www.biglistoflittlethings.com/3rdparty?url=";

//临时用户
var tmpUser = "";

//item id
var id = "null";
var bonus = 0;

//当前浏览内容
var stuff=null;

var galleryWidth = 672;
var galleryHeight = 378;

//记录分享用户、分享达人
var from = "mp";//链接来源，默认为公众号进入
var fromUser = "";
var fromBroker = "";
var broker = {};//当前达人

//viewTemplate id 根据指定模板显示海报。默认为null，将采用本地默认内容显示。本地显示同时作为新模板测试用途。
var templateId = null;//此处仅兼容posterId

var posterId = null;//海报scheme
var brokerQrcode = null;//存放达人二维码url

//生成短连接及二维码
/**
function generateQRcode(){
    console.log("start generate qrcode......");
    var longUrl = window.location.href.replace(/info2ext/g,"info").replace(/fromBroker/g,"fromBrokerOrigin").replace(/fromUser/g,"fromUserOrigin");//获取分享目标链接
    longUrl += "&fromBroker="+broker.id;
    longUrl += "&fromUser="+(app.globalData.userInfo._key?app.globalData.userInfo._key:"");
    var header={
        "Content-Type":"application/json"
    };
    util.AJAX(app.config.auth_api+"/wechat/ilife/short-url", function (res) {
        console.log("generate short url.",longUrl,res);
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
//**/

//生成短连接及二维码
function generateQrcode(){
    console.log("start generate qrcode......");
    var longUrl = window.location.href.replace(/info2\-poster/g,"info2").replace(/fromBroker/g,"fromBrokerOrigin").replace(/fromUser/g,"fromUserOrigin");//获取分享目标链接
    longUrl += "&fromBroker="+broker.id;
    longUrl += "&fromUser="+(app.globalData.userInfo._key?app.globalData.userInfo._key:""); 
    
    //生成短码并保存
    var shortCode = generateShortCode(longUrl);
    console.log("got short code",shortCode);
    saveShortCode(hex_md5(longUrl),id,fromBroker,fromUser,"mp",encodeURIComponent(longUrl),shortCode);    
    var shortUrl = "https://www.biglistoflittlethings.com/ilife-web-wx/s.html?s="+shortCode;//必须是全路径
    //var logoUrl = imgPrefix+app.globalData.userInfo.avatarUrl;//需要中转，否则会有跨域问题
    var logoUrl = "https://www.biglistoflittlethings.com/static/logo/distributor-square/"+stuff.source+".png";//采用平台logo

    //生成二维码
    var qrcode = new QRCode(document.getElementById("app-qrcode-box"), {
        text: shortUrl,
        width: 96,
        height: 96,    
        drawer: 'png',
        logo: logoUrl,
        logoWidth: 24,
        logoHeight: 24,
        logoBackgroundColor: '#ffffff',
        logoBackgroundTransparent: false
    });  
    setTimeout(generateImage,1200);//需要等待二维码绘制完成
}

//转换二维码svg为图片
function generateImage() {
    console.log("try generate image.");
    var canvas = $('#app-qrcode-box canvas');
    console.log(canvas);
    var img = canvas.get(0).toDataURL("image/png");

    //将二维码图片上传到fastdfs
    uploadPngFile(img, "qrcode"+stuff._key+posterId+".png");//文件名称以itemKey+posterId唯一识别

    //隐藏canvas
    jQuery("#app-qrcode-box canvas").css("display","none");
}

//上传二维码到poster服务器，便于生成使用
function uploadPngFile(dataurl, filename){
    //dataurl = $("#app-qrcode-box img").attr("src");
    //filename = "broker-qrcode-"+broker.id+posterId+".png";
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

//将item显示到页面
function showContent(item){
    //分享海报日志
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
    logstash(stuff,"mp","share poster",shareUserId,shareBrokerId,function(res){
        console.log("分享海报",res);
    }); 

}

//根据openid查询加载broker
function loadBrokerByOpenid(openid) {
    console.log("try to load broker info by openid.[openid]",openid);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/brokerByOpenid/"+openid, function (res) {
        console.log("load broker info.",openid,res);
        if (res.status) {
            broker = res.data;    
            //填写清单信息
            $("#broker-name").html((broker.name?broker.name:app.globalData.userInfo.nickName)+ " 推荐");    //默认作者为当前broker    
            if(stuff&&stuff.link&&stuff.link.qrcode){//直接用原始二维码图片
                show3rdPartyPost();
            }else{//生成达人专属二维码，并在二维创建后生成海报
                generateQrcode();   
            }  
        }
        //加载达人后再注册分享事件：此处是二次注册，避免达人信息丢失。
        registerShareHandler();
    });
}

function loadItem(key){//获取内容列表
    $.ajax({
        url:"https://data.shouxinjk.net/_db/sea/my/stuff/"+key,
        type:"get",
        data:{},
        success:function(data){
            console.log("load item.", data);
            stuff = data;//本地保存，用于分享等后续操作
            //准备生成海报：
            requestPosterScheme();//请求生成海报：会判断是否已经加载完成

            //显示内容：当前仅记录日志
            showContent(stuff);

            //加载推荐语
            if(stuff.meta && stuff.meta.category){
                requestAdviceScheme();
            }            

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
    })            
}


//装载模板选择滑动条
var currentTemplate = null;
var hasTemplates = false;
var hasPosters = false;
function showSwiper(type){
    if(type=="template")hasTemplates=true;
    if(type=="poster")hasPosters=true;

    //必须template及poster均已加载才装配
    if(!hasTemplates || !hasPosters)
        return;

    //将viewTemplate装载到页面
    for (var key in viewTemplates) {
        if($("#"+key).length == 0)
            insertTemplate(viewTemplates[key],"template");
    }  
    //将posterScheme装载到页面  
    for (var key in posterSchemes) {
        if($("#"+key).length == 0)
            insertTemplate(posterSchemes[key],"poster");
    }      
  
    //显示滑动条
    var mySwiper = new Swiper ('.swiper-container', {
        //slidesPerView: 4,
        slidesPerView: from=="web"?parseInt(document.getElementsByTagName('html')[0].clientWidth/100):5,
    });  
    //调整swiper 风格，使之悬浮显示
    $(".swiper-container").css("position","relative");
    $(".swiper-container").css("left","0");
    $(".swiper-container").css("top","40");
    $(".swiper-container").css("z-index","999");
    $(".swiper-container").css("background-color","#f6d0ca");
    //$(".swiper-container").css("margin-bottom","3px");
  
    //将当前用户设为高亮  
    if(templateId && templateId.trim().length>0){
        currentTemplate = templateId;
    }else{//根据当前用户加载数据：默认使用第一个：注意由于viewTemplates为object，需要根据第一个键值获取
        currentTemplate = viewTemplates[Object.keys(viewTemplates)[0]].id; 
    }   
    //把当前选中的高亮  
    highlightTemplate(currentTemplate);      
}

//将viewTemplate及psoterScheme显示到滑动条
//注意默认认为两者都拥有id及logo字段，并在装载时指定type
function insertTemplate(item,type){
    console.log("insert template.",type,item);
    // 获取logo
    var logo = "http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(11)+".jpeg";
    if(item.logo)
        logo = item.logo;
    // 显示HTML
    var html = '';
    html += '<div class="swiper-slide">';
    html += '<div id="'+item.id+'" data-type="'+type+'" style="border:1px solid siver;border-radius:5px;vertical-align:middle;padding:3px 0;">';
    var style= item.id==currentTemplate?'border:2px solid #e16531':'border:2px solid #f6d0ca';
    html += '<img style="object-fit:cover;border-radius:10px;'+style+'" src="'+logo+'" width="68" height="68"/>';
    html += '</div>';
    $("#tempaltes").append(html);

    //注册事件:点击后切换
    $("#"+item.id).click(function(e){
        console.log("try to change template.",e.currentTarget.id,$(this).data("type"));
        if(e.currentTarget.id == currentTemplate){//点击当前选中模板，啥也不干
            //do nothing
        }else{//否则，高亮显示选中的模板
            changeTemplate(e.currentTarget.id,$(this).data("type"));
        }
    });
}

//切换海报模板
function changeTemplate (templateId,type) {
    var ids = templateId;
    if (app.globalData.isDebug) console.log("Feed::ChangePerson change person.",currentTemplate,templateId);
    $("#"+currentTemplate+" img").css("border","2px solid #e16531");
    $("#"+ids+" img").css("border","2px solid #f6d0ca");

    //TODO 重新生成海报
    if(type=="template"){//如果是viewTemplate则直接重新生成
        //window.location.href=window.location.href.replace(/info2-poster/,"info2ext")+"&tempalteId="+templateId;
        window.location.href=window.location.href.replace(/info2-poster/,"info2ext").replace(/posterId/,"templateId").replace(currentTemplate,templateId);
        //当前页面内生成有问题，直接采用跳转的方式生成
        /**
        currentTemplate = templateId;
        $("#container").empty();//清空海报容器及内容
        $("#share-img").empty();//清空已经生成的图片
        //$("#post-mask").toggleClass("post-mask-hide",false);  
        showPostMask();
        preloadList.push(imgPrefix+stuff.images[0].replace(/\.avif/,''));
        showContent(stuff);
        //loadBrokerByOpenid(app.globalData.userInfo._key);
        generateQrcode(); //重新生成二维码
        //**/
    }else{//否则跳转到后台海报生成界面
        //window.location.href=window.location.href.replace(/info2ext/,"info2-poster")+"&posterId="+templateId;
        window.location.href=window.location.href.replace(currentTemplate,templateId);//直接跳转
    }

  } 

//仅高亮模板标记，不重新加载数据
function highlightTemplate (templateId) {
    var ids = templateId;
    if (app.globalData.isDebug) console.log("Index::highlightPerson highlight person.",currentTemplate);
    $("#"+currentTemplate+" img").css("border","2px solid #f6d0ca");
    $("#"+ids+" img").css("border","2px solid #e16531");
  }  

//加载海报模板列表：加载所有可用单品海报模板
var viewTemplates = {};//缓存所有模板，格式：id:{view template object}
function requestViewTemplates(){
    //获取模板列表
    $.ajax({
        url:app.config.sx_api+"/mod/viewTemplate/rest/listByType/item-poster",
        type:"get",
        data:{},
        success:function(schemes){
            console.log("\n===got item poster schemes ===\n",schemes);
            //遍历模板
            for(var i=0;i<schemes.length;i++){
                //将模板显示到界面，等待选择后生成
                if(!viewTemplates[schemes[i].id])
                    viewTemplates[schemes[i].id] = schemes[i];
            }
            showSwiper("template");
        },
         error: function(xhr, status, error){
             console.log("load item poster scheme error.",error);
         },
         complete:function(data){
            //加载商品并尝试生成海报：无论失败与否都要加载的
            loadItem(id);             
         }
    });  
}

            
//生成商品海报：先获得海报列表
//TODO：当前是从所有列表中过滤，需要调整为根据ID获取海报scheme
var posterSchemes = {};
function requestPosterScheme(){
    if( !brokerQrcode || !stuff ){
        console.log("poster is not ready....wait....");
        return;
    }
    console.log("poster ready....try to generate....");
    $.ajax({
        url:app.config.sx_api+"/mod/posterTemplate/rest/item-templates",
        type:"get",
        data:{categoryId:stuff.meta.category},
        success:function(schemes){
            console.log("\n===got item poster scheme ===\n",schemes);
            //遍历海报并生成
            for(var i=0;i<schemes.length;i++){
                if(!posterSchemes[schemes[i].id])
                    posterSchemes[schemes[i].id] = schemes[i];//记录poster定义
                if(posterId == schemes[i].id){
                    requestPoster(schemes[i]);
                    //break;//找到就结束
                }
                console.log("cannot find poster scheme by id.[id]"+posterId);
            }
            showSwiper("poster");
        }
    });  
}

//生成海报，返回海报图片URL
//注意：海报模板中适用条件及参数仅能引用这三个参数
function requestPoster(scheme,xBroker,xItem,xUser){
    //判断海报模板是否匹配当前条目：
    var isOk = true;
    if(scheme.cirteria && scheme.cirteria.length>0){//如果设置了适用条件则进行判断
        try{
            isOk = eval(scheme.cirteria);
        }catch(err){
            console.log("\n=== eval poster condition error===\n",err);
        }
    }
    if(!isOk){//如果不满足则直接跳过
        console.log("condition not satisifed. ignore.");
        //显示提示浮框
        siiimpleToast.message('啊哦，需要完成标注才可以哦~~',{
              position: 'bottom|center'
            });         
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


//生成文案列表：请求文案列表，请求后直接生成文案
var advicesShowed = [];//已显示文案内容，由于需要根据scheme生成，同时融合item内已提交的advice，需要排重
function requestAdviceScheme(){
    //获取模板列表
    $.ajax({
        url:app.config.sx_api+"/mod/template/rest/item-templates",
        type:"get",
        data:{categoryId:stuff.meta.category},
        success:function(schemes){
            console.log("\n===got item advice schemes ===\n",schemes);
            //遍历并生成文案
            var total = 0;
            for(var i=0;i<schemes.length;i++){
                //将模板显示到界面，等待选择后生成
                requestAdvice(schemes[i]);
                total++;
            }
            if(total==0){
                console.log("no advices available.");//提示缺少文案定义
            }
        }
    });  
}

//生成文案
function requestAdvice(scheme){
    //判断海报模板是否匹配当前条目
    var isOk = false;
    if(scheme.criteria && scheme.criteria.length>0){//如果设置了适用条件则进行判断
        try{
            isOk = eval(scheme.criteria);
        }catch(err){
            console.log("\n=== eval poster condition error===\n",err);
        }
    }else{//如果未设置条件则表示适用于所有商品
        isOk = true;
    }
    if(!isOk){//如果不满足则直接跳过
        console.log("condition not satisifed. ignore.");
        return;       
    }

    //检查是否已经生成，如果已经生成则不在重新生成
    /**
    if(stuff.advice && stuff.advice[scheme.id]){
        console.log("\n=== advice exists. ignore.===\n");
        return;
    }
    //**/

    //生成文案
    try{
        eval(scheme.expression);//注意：脚本中必须使用 var xAdvice=**定义结果
    }catch(err){
        return;//这里出错了就别玩了
    }
    //将文案显示到界面
    var adviceIdx = scheme.id;
    var adviceTxt = xAdvice;
    if(advicesShowed.indexOf(adviceTxt)<0){
        $("#advicesDiv").append("<div style='line-height:18px;line-height:18px;width:90%;border-top:1px solid silver;font-size:12px;padding-top:10px; padding-bottom:10px;' id='adviceEntry"+adviceIdx+"' data-clipboard-text='"+adviceTxt+"'>"+adviceTxt+"</div>");
        var clipboard = new ClipboardJS('#adviceEntry'+adviceIdx);
        clipboard.on('success', function(e) {
            console.info('advice copied:', e.text);
            siiimpleToast.message('推荐语已复制~~',{
                  position: 'bottom|center'
                }); 
        }); 
        advicesShowed.push(adviceTxt);
        $("#advicesTitleDiv").css("display","block");
    }
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
    var shareUrl = window.location.href.replace(/info2/g,"share");//需要使用中间页进行跳转
    if(shareUrl.indexOf("?")>0){//如果本身带有参数，则加入到尾部
        shareUrl += "&fromUser="+shareUserId;
        shareUrl += "&fromBroker="+shareBrokerId;
    }else{//否则作为第一个参数增加
        shareUrl += "?fromUser="+shareUserId;
        shareUrl += "&fromBroker="+shareBrokerId;        
    }
    shareUrl += "&origin=item";//添加源，表示是一个单品分享

    ////多站点处理：start//////////////////////////////////
    //由于不同平台通过不同站点，需要进行区分是shouxinjk.net还是biglistoflittlethings.com
    if(stuff&&stuff.source=="jd"){//如果是京东，则需要指明跳转到shouxinjk.net
        shareUrl += "&toSite=shouxinjk"; 
    }
    ////多站点处理：end////////////////////////////////////

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
                    title:stuff?stuff.title:"小确幸，大生活", // 分享标题
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl:stuff?stuff.images[0]:"http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(11)+".jpeg", // 分享图标
                    success: function () {
                        // 用户点击了分享后执行的回调函数
                        logstash(stuff,"mp","share timeline",shareUserId,shareBrokerId,function(res){
                            console.log("分享到朋友圈",res);
                        }); 
                    },
                });
                //分享给朋友
                wx.onMenuShareAppMessage({
                    title:stuff?stuff.title:"小确幸，大生活", // 分享标题
                    desc:stuff&&stuff.tags?stuff.tags.join(" "):"Live is all about having a good time.", // 分享描述
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl: stuff?stuff.images[0]:"http://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg", // 分享图标
                    type: 'link', // 分享类型,music、video或link，不填默认为link
                    dataUrl: '', // 如果type是music或video，则要提供数据链接，默认为空
                    success: function () {
                      // 用户点击了分享后执行的回调函数
                        logstash(stuff,"mp","share appmsg",shareUserId,shareBrokerId,function(res){
                            console.log("分享到微信",res);
                        }); 
                    }
                });            
            });
        }
    })    
}
