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
    id = args["id"];//当前board id

    from = args["from"]?args["from"]:"mp";//可能为groupmessage,timeline等
    fromUser = args["fromUser"]?args["fromUser"]:"";//从连接中获取分享用户ID
    fromBroker = args["fromBroker"]?args["fromBroker"]:"";//从连接中获取分享达人ID。重要：将依据此进行收益计算

    //检查设置首次触达达人
    if(fromBroker && fromBroker.trim().length>0){
        util.checkInitBroker(fromBroker);
    }

    posterId = args["posterId"]?args["posterId"]:null;//从连接中获取海报ID，默认为空。如果没有则跳转到默认海报生成

    //计算图片流宽度：根据屏幕宽度计算，最小显示2列
    if(width < 2*columnWidth){//如果屏幕不能并排2列，则调整图片宽度
        columnWidth = (width-columnMargin*4)/2;//由于每一个图片左右均留白，故2列有4个留白
    }

    $('#waterfall').NewWaterfall({
        width: columnWidth,
        delay: 100,
    });  

    //需要判定进入来源：如果是通过分享链接进入则要重新获取openid

    //判断屏幕大小，如果是大屏则跳转
    /**
    if(width>=800){
        window.location.href=window.location.href.replace(/info2.html/g,"info.html");
    }
    //**/

    //加载达人信息
    loadBrokerInfo();

    //加载内容
    loadBoard(id); 
    //加载清单item列表
    loadBoardItems(id);

    //加载导航和关注列表
    loadCategories(category);  
 
});

util.getUserInfo();//从本地加载cookie

//board id
var id = "null";
var bonusMin = 0;
var bonusMax = 0;

//临时用户
var tmpUser = "";

var items = [];//board item 列表

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

var posterId = null;//海报模板ID

//优先从cookie加载达人信息
function loadBrokerInfo(){
  broker = util.getBrokerInfo();
}

var boardItemTemplate = '<div class="board-item-wrapper">'+
                            '<div class="board-item-title">'+
                              '<span class="board-item-title-head">推荐__NUMBER</span>'+
                              '<span class="board-item-title-text">__TITLE</span>'+
                            '</div>'+   
                            '<div class="board-item-description">__DESCRIPTION</div>'+                                   
                        '</div>';

//将board内容显示到页面
function showContent(board){
    //标题
    console.log("display edit button.[current broker id]"+broker.id+"[board broker id]"+board.broker.id);
    if(broker && broker.id == board.broker.id){//如果是当前达人则可以直接修改
        $("#title").html(
            board.title
            +"&nbsp;<a style='color:#E16531;display:inline;font-size:12px;' href='#' id='btnPush'>云推送</a>"
            +"&nbsp;<a style='color:#006cfd;display:inline;font-size:12px;' href='broker/boards-modify.html?id="+board.id+"'>修改</a>"
            );
    }else if(broker && broker.id){//如果不是编辑达人，则先克隆后再需改
        $("#title").html(
            board.title
            +"&nbsp;<a style='color:#E16531;display:inline;font-size:12px;' href='#' id='btnPush'>云推送</a>"
            +"&nbsp;<a style='color:#006cfd;display:inline;font-size:12px;'>克隆</a>"
            );
        $("#cloneBoardBtn").click(function(){
            console.log("try to clone board.[boardId]"+board.id+"[brokerId]"+broker.id);
            util.AJAX(app.config.sx_api+"/mod/board/rest/board/clone/"+board.id+"/"+broker.id, function (res) {
                console.log("clone broker successfully.",res);
                //跳转到编辑界面
                window.location.href = "broker/boards-modify.html?id="+res.data.id;    
            },"POST",null,{ "Content-Type":"application/json" });            
        });
    }else{//普通用户则只显示标题
        $("#title").html(board.title);
    }
    
    //作者与发布时间
    $("#author").html(board.broker.name?board.broker.name:app.globalData.userInfo.nickName);    //默认作者为board创建者
    $("#publish-time").html(board.updateDate.split(" ")[0]);   

    //摘要
    $("#content").html(board.description);

    //分享链接
    if(posterId){//如果指定海报ID
        $("#share-link").attr("href","board2-poster.html?type=board2-waterfall&id="+id+"&posterId="+posterId);
    }else{
        $("#share-link").attr("href","board2ext.html?type=board2-waterfall&id="+id);
    }

    //检查并修改分享者为fromBroker
    //如果带有fromBroker，则加载对应达人并显示到作者。注意：仅修改显示，不修改broker信息
    if(fromBroker && fromBroker.trim().length>0){//根据分享者加载对应达人
        loadBrokerById(fromBroker);
    }  

    //注册事件：云推送
    $("#btnPush").click(function(){
        event.stopPropagation();//阻止触发跳转详情

        //检查商品条目数量，少于3条不推送
        if(items.length<3){
            console.log("no enough board items. ignore.");
            siiimpleToast.message('至少要有3个商品，请添加~~',{
              position: 'bottom|center'
            });             
        }else{
            //推送到CK，同步发送到微信群
            wxGroups.forEach(function(wxgroup){
                saveFeaturedItem(getUUID(), broker.id, "wechat", wxgroup.id, wxgroup.name, "board", board.id, JSON.stringify(board), "pending");
            });   
            if(wxGroups.length>0){
                console.log("wxgroups synchronized.");
                siiimpleToast.message('推送已安排~~',{
                  position: 'bottom|center'
                });             
            }else{
                console.log("no wxGroups.");
                siiimpleToast.message('还未开通云助手，请联系客服~~',{
                  position: 'bottom|center'
                });          
            }
        }

    });

    //TODO:记录board浏览历史
    /*
    logstash(item,from,"view",fromUser,fromBroker,function(){
        //do nothing
    });   
    //**/   
}

function showShareContent(){
    var strBonus = "";
    if(bonusMin>0){
        strBonus += "返￥"+(parseFloat(new Number(bonusMin).toFixed(1))>0?parseFloat(new Number(bonusMin).toFixed(1)):parseFloat(new Number(bonusMin).toFixed(2)));
    }
    if(bonusMax>0 && bonusMax > bonusMin){
        strBonus += "-"+parseFloat(Number(bonusMax).toFixed(1));
    }else if(bonusMin>0){
        strBonus += " 起";
    }else{
        strBonus += "推广积分";
    }
    //console.log("try update bouns.",strBonus);
    $("#share-bonus").html(strBonus);
    //默认隐藏，仅对达人开放显示
    if(broker && broker.id){
        $("#share-bonus").toggleClass("share-bonus",true);
        $("#share-bonus").toggleClass("share-bonus-hide",false);
    }else{
        $("#share-bonus").toggleClass("share-bonus",false);
        $("#share-bonus").toggleClass("share-bonus-hide",true);
    }
    /*
    if(strBonus.length > 0){//显示佣金
        $("#share-bonus").html("返￥"+strBonus);
        $("#share-bonus").toggleClass("share-bonus",true);
        $("#share-bonus").toggleClass("share-bonus-hide",false);  
    }else{
       $("#share-bonus").toggleClass("share-bonus",false);
       $("#share-bonus").toggleClass("share-bonus-hide",true);        
    }
    //**/
}

//根据openid查询加载broker
function loadBrokerByOpenid(openid) {
    //console.log("try to load broker info by openid.[openid]",openid);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/brokerByOpenid/"+openid, function (res) {
        console.log("load broker info.",openid,res);
        if (res.status) {//将佣金信息显示到页面
            broker = res.data;
            loadWxGroups(res.data.id);//加载该达人的微信群
            $("#author").html(broker.nickname);    //如果当前用户是达人，则转为其个人board     
            $("#sharebox").css("display","block");      //仅对达人显示分享框
        }
        //加载达人后再注册分享事件：此处是二次注册，避免达人信息丢失。
        registerShareHandler();       
    });
}

//根据达人ID加载活跃微信群
var wxGroups = [];//存储当前达人的微信群列表
function loadWxGroups(brokerId){
    console.log("try to load wx groups by brokerId.",brokerId);
    $.ajax({
        url:app.config.sx_api+"/wx/wxGroup/rest/listByBrokerId?brokerId="+brokerId,
        type:"get",        
        success:function(ret){
            console.log("===got wx groups===\n",ret);
            wxGroups = ret;
        }
    }); 
}
//存储featured item到ck
function saveFeaturedItem(eventId, brokerId, groupType, groupId, groupName,itemType, itemKey, jsonStr, status){
  var q = "insert into ilife.features values ('"+eventId+"','"+brokerId+"','"+groupType+"','"+groupId+"','"+groupName+"','"+itemType+"','"+itemKey+"','"+jsonStr.replace(/'/g, "’")+"','"+status+"',now())";
  console.log("try to save featured item.",q);
  jQuery.ajax({
    url:app.config.analyze_api+"?query=",//+encodeURIComponent(q),
    type:"post",
    data:q,
    headers:{
        "content-type": "text/plain; charset=utf-8", // 直接提交raw数据
        "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
    },         
    success:function(json){
      console.log("===featured item saved.===\n",json);
    }
  });    
}


//根据id查询加载broker
function loadBrokerById(brokerId) {
    //console.log("try to load broker info by id.[brokerId]",brokerId);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/brokerById/"+brokerId, function (res) {
        console.log("load broker info.",brokerId,res);
        if (res.status) {//将佣金信息显示到页面
            $("#author").html(res.data.nickname);    //如果当前用户是达人，则转为其个人board           
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
            showContent(res.data);

            //注册事件：根据关键词搜索更多
            $("#jumpToSearch").click(function(){
                window.location.href="index.html?keyword="+board.keywords;
            });            

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
        var hits = res;
        for(var i = 0 ; i < hits.length ; i++){
            loadBoardItem(hits[i]);//查询具体的item条目
        }        
    }, "GET",{},header);
}


function loadBoardItem(item){//获取内容列表
    $.ajax({
        url:"https://data.shouxinjk.net/_db/sea/my/stuff/"+item.item,
        type:"get",
        data:{},
        success:function(data){
            item.stuff = data;//装载stuff到boarditem   
            items.push(item); //装载到列表 
            insertBoardItem(); //显示到界面    
        }
    })            
}

//将item显示到页面。每一个item提供推荐标题、推荐描述编辑。并展示对应的itemlogo、来源、原始标题及tag
function insertBoardItem(){
    // 加载内容
    var item = items[num-1];
    if(!item)return;

    // 获取佣金：获取范围
    //console.log("Board::insertBoardItem load share info.", item);
    if(item.stuff.profit && item.stuff.profit.order && item.stuff.profit.order >0){
        //console.log("Board::insertBoardItem load share info. step 2...", item);
        if( bonusMax == 0 & bonusMin ==0 ){//首先将两者均设为第一个值
            bonusMin = item.stuff.profit.order;
            bonusMax = item.stuff.profit.order;
        }
        if( item.stuff.profit.order > bonusMax){
            bonusMax = item.stuff.profit.order;
        }
        if( item.stuff.profit.order < bonusMin){
            bonusMin = item.stuff.profit.order;
        }
        //showShareContent();//当前无佣金时也显示
    }   
    showShareContent();//更新佣金

    var logoImg = "images/tasks/board.png";
    if(item.stuff && item.stuff.images && item.stuff.images.length>0){
        logoImg = item.stuff.images[0].replace(/\.avif/,'');//默认用第一张图片做logo
    }

    //计算图片宽度与高度
    var imgWidth = columnWidth-2*columnMargin;//注意：改尺寸需要根据宽度及留白计算，例如宽度为360，左右留白5，故宽度为350
    var imgHeight = 50;//随机指定初始值
    //计算图片高度
    var img = new Image();
    img.src = logoImg;
    var orgWidth = img.width;
    var orgHeight = img.height;
    imgHeight = orgHeight/orgWidth*imgWidth;

    //显示所关联stuff内容
    var image = "<img src='"+logoImg+"' width='"+imgWidth+"' height='"+imgHeight+"'/>";
    var title = "<div class='board-item-title'>"+item.stuff.title+"</div>";

/////////////
    var tagTmpl = "<a class='itemTag' href='index.html?keyword=__TAGGING'>__TAG</a>";
    var highlights = "<div class='itemTags'>";
    highlights += "<a class='itemTagPrice' href='#'>"+(item.stuff.price.currency?item.stuff.price.currency:"¥")+item.stuff.price.sale+"</a>";
    if(item.stuff.price.coupon>0){
        highlights += "<span class='couponTip'>券</span><span class='coupon' href='#'>"+item.stuff.price.coupon+"</span>";
    }    
    highlights += tagTmpl.replace("__TAGGING",item.stuff.distributor.name).replace("__TAG",item.stuff.distributor.name).replace("itemTag","itemTagDistributor");
    highlights += "</div>";

    var tags = "<div class='itemTags'>";
    var taggingList = item.stuff.tagging?item.stuff.tagging.split(" "):[];
    for(var t in taggingList){
        var txt = taggingList[t];
        if(txt.trim().length>1 && txt.trim().length<6){
            tags += tagTmpl.replace("__TAGGING",txt).replace("__TAG",txt);
        }
    }
    if(item.categoryId && item.categoryId.trim().length>1){
        tags += tagTmpl.replace("__TAGGING",item.stuff.category).replace("__TAG",item.stuff.category);
    }
    tags += "</div>";
/////////////

    //添加评价指标
    var measures = "<div id='measure-"+item.stuff._key+"' style='display:none'></div>";


    //显示boarditem推荐标题及推荐描述
    var boardItemDetail = boardItemTemplate
            .replace(/__NUMBER/g," "+num)
            .replace(/__TITLE/g,item.title?" "+item.title:"")
            .replace(/__DESCRIPTION/g,item.description?item.description:"");

    $("#waterfall").append("<li><div class='board-item' id='board-item-"+item.stuff._key+"'>" + image + title +highlights+ tags +measures+"</div></li>");

    //注册事件：能够跳转到指定item
    $('#board-item-'+item.stuff._key).click(function(){
        var targetUrl = "info2.html?id="+item.stuff._key;
        //根据是否是海报进入区分跳转：如果是海报进入则直接跳转到第三方页面
        if(posterId&&!item.stuff.link.token){//对于淘宝等还是要进入详情页面，可以直接复制淘口令
            targetUrl = "go.html?id="+item.stuff._key;
        }
        if(broker&&broker.id){//如果当前用户是达人，则使用当前达人跟踪。
            targetUrl += "&fromBroker="+broker.id;
        }else if(board&&board.broker.id){//否则，使用board的创建者进行跟踪
            targetUrl += "&fromBroker="+board.broker.id;
        }
        window.location.href=targetUrl;
    });

    //装载评价数据：查询后动态添加
    if(item.stuff.meta&&item.stuff.meta.category){
      loadMeasureSchemes(item.stuff);
    }

    num++;
    // 表示加载结束
    loading = false;
}


//加载客观评价指标
function loadMeasureSchemes(stuff){
    //获取类目下的特征维度列表
    $.ajax({
        url:app.config.sx_api+"/mod/itemDimension/rest/featured-dimension",
        type:"get",
        //async:false,//同步调用
        data:{categoryId:stuff.meta.category},
        success:function(featuredDimension){
            console.log("===got featured dimension===\n",featuredDimension);
            loadMeasureScores(stuff,featuredDimension);
        }
    });  
}
//加载指定item的评分
function loadMeasureScores(stuff,featuredDimension){
    var itemScore = {};
    //根据itemKey获取评价结果
    //feature = 1；dimensionType：0客观评价，1主观评价
    //注意：由于clickhouse非严格唯一，需要取最后更新值
    $.ajax({
        url:app.config.analyze_api+"?query=select dimensionId,score from ilife.info where feature=1 and dimensionType=0 and itemKey='"+stuff._key+"' order by ts format JSON",
        type:"get",
        //async:false,//同步调用
        //data:{},
        headers:{
            "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
        },         
        success:function(json){
            console.log("===got item score===\n",json);
            for(var i=0;i<json.rows;i++){
                itemScore[json.data[i].dimensionId] = json.data[i].score;
            }
            console.log("===assemble item score===\n",itemScore);
            showMeasureScores(stuff,featuredDimension,itemScore);
        }
    });   
}
//显示客观评价得分
function showMeasureScores(stuff,featuredDimension,itemScore){
    var colors = ['#8b0000', '#dc143c', '#ff4500', '#ff6347', '#1e90ff','#00ffff','#40e0d0','#9acd32','#32cd32','#228b22'];
    //准备评分表格：根据评价维度逐行显示
    featuredDimension.forEach(function(dimension){
      var html  = '<div id="mscore-'+stuff._key+dimension.id+'" data-init="true"></div>';//以itemKey+dimensionId为唯一识别
      var score = itemScore[dimension.id]?itemScore[dimension.id]*10:(Math.floor(Math.random() * 75)*0.1+2.5);//如果没有标注则随机展示
      var colorIndex = Math.round(score);//四舍五入取整
      if(colorIndex>9)colorIndex=9;
      $("#measure-"+stuff._key).append(html);
      $('#mscore-'+stuff._key+dimension.id).LineProgressbar({
                percentage: score,
                title:dimension.name,
                unit:'/10',
                fillBackgroundColor:colors[colorIndex],
                //animation:false
            });    
    });   
    $("#measure-"+stuff._key).css("display","block");
}

function loadCategories(currentCategory){
    $.ajax({
        url:app.config.sx_api+"/mod/channel/rest/channels/active",
        type:"get",
        success:function(msg){
            var navObj = $(".navUl");
            for(var i = 0 ; i < msg.length ; i++){
                navObj.append("<li data='"+msg[i].id+"'>"+msg[i].name+"</li>");
                if(currentCategory == msg[i].id)//高亮显示当前选中的category
                    $(navObj.find("li")[i]).addClass("showNav");
            }
            //注册点击事件
            navObj.find("li").click(function(){
                var key = $(this).attr("data");
                //跳转到首页
                window.location.href = "index.html?category="+key;
            })
        }
    })    
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
    var shareUrl = window.location.href.replace(/board2-waterfall/g,"share");//需要使用中间页进行跳转
    if(shareUrl.indexOf("?")>0){//如果本身带有参数，则加入到尾部
        shareUrl += "&fromUser="+shareUserId;
        shareUrl += "&fromBroker="+shareBrokerId;
    }else{//否则作为第一个参数增加
        shareUrl += "?fromUser="+shareUserId;
        shareUrl += "&fromBroker="+shareBrokerId;        
    }
    shareUrl += "&origin=board-waterfall";//添加源，表示是一个列表页分享

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
                //分享到朋友圈
                wx.updateTimelineShareData({
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
                wx.updateAppMessageShareData({
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
