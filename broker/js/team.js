// 文档加载完毕后执行
$(document).ready(function ()
{
    //根据屏幕大小计算字体大小
    const oHtml = document.getElementsByTagName('html')[0]
    const width = oHtml.clientWidth;
    var rootFontSize = 12 * (width / 1440);// 在1440px的屏幕基准像素为12px
    rootFontSize = rootFontSize <8 ? 8:rootFontSize;//最小为8px
    rootFontSize = rootFontSize >16 ? 16:rootFontSize;//最大为18px
    oHtml.style.fontSize = rootFontSize+ "px";   
    //显示加载状态
    showloading(true);
    //处理参数
    var args = getQuery();//获取参数
    if(args["id"]){
        currentPerson = args["id"]; //如果传入参数则使用传入值
    }

    $('#waterfall').NewWaterfall({
        width: columnWidth,
        delay: 100,
    });     

    $("body").css("background-color","#fff");//更改body背景为白色

    loadPerson(currentPerson);//加载用户

    //注册事件：切换操作类型
    $(".order-cell").click(function(e){
        changeActionType(e);
    });

    //注册添加关心的人事件
    $("#add-team-member").click(function(){
        //点击后跳转到对应用户设置界面
        window.location.href = "team-poster.html";//跳转到海报生成界面
    });     

    //对于关注时未能获取userInfo使用Fake填充
    faker.locale = "zh_CN";//默认英文

});

util.getUserInfo();//从本地加载cookie

var columnWidth = 800;//默认宽度600px
var columnMargin = 5;//默认留白5px
var loading = false;
var dist = 500;
var num = 1;//需要加载的内容下标

var items = [];//所有下级达人
var brokerUsers = {};//下级达人对应的用户列表。brokerId:persona，能够根据达人ID获取用户对象。

var page = {
    size:20,//每页条数
    total:1,//总页数
    current:-1//当前翻页
};

var currentActionType = '';//当前操作类型
var tagging = '';//操作对应的action 如buy view like 等

var currentPerson = app.globalData.userInfo?app.globalData.userInfo._key:null;
var userInfo=app.globalData.userInfo;//默认为当前用户

//加载徽章，根据达人等级显示
var badges = [];
function loadBadges() {
    console.log("try to load badges.");
    util.AJAX(app.config.sx_api+"/mod/badge/rest/badges", function (res) {
        console.log("load broker badges.",res);
        badges = res;
    });
}

setInterval(function ()
{
    if ($(window).scrollTop() >= $(document).height() - $(window).height() - dist && !loading)
    {
        // 表示开始加载
        loading = true;
        showloading(true);

        // 加载内容
        if(items.length < num){//如果内容未获取到本地则继续获取
            loadItems();
        }else{//否则使用本地内容填充
            insertItem();
        }
    }
}, 300);

//加载下级达人
var childBrokerIds = [];//记录已经加载的达人ID，避免重复
function loadItems(){
    util.AJAX(app.config.sx_api+"/mod/broker/rest/brokersByOpenid/"+currentPerson, function (res) {
        showloading(false);
        console.log("Team::loadItems try to retrive brokers by presonId.", res)
        if(res && res.length==0){//如果没有画像则提示，
            shownomore();
        }else{//否则显示到页面
            //更新当前翻页
            page.current = page.current + 1;
            //装载具体条目
            var hits = res;
            for(var i = 0 ; i < hits.length ; i++){
                if(childBrokerIds.indexOf(hits[i].id)<0){
                    childBrokerIds.push(hits[i].id);
                    //getBrokerUser(hits[i]);//不加载用户详情，提升性能
                    //直接显示到界面
                    items.push(hits[i]);//仅在用户存在是显示达人，否则不显示
                    brokerUsers[hits[i].id]=hits[i];//存储对应的用户详情：此处直接使用broker信息，未加载用户详情
                    insertItem();  
                    //end of 直接显示到界面
                }
            }
            //insertItem();
        }
    }, "GET",{
        from:(page.current+1)*page.size,
        to:(page.current+1)*page.size+page.size
    },{});
}

//根据openId加载指定的关联用户Item
function getBrokerUser(broker) {
    console.log("try to load connected person info.",broker);
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    };     
    if(broker.openid && broker.openid.trim().length>0){//仅拥有openid才获取。对于平台收益等特殊broker，未设置openid
        util.AJAX(app.config.data_api+"/user/users/"+broker.openid, function (res) {
            console.log("load person info by openid.",broker.openid,res);
            if(res){
                items.push(broker);//仅在用户存在是显示达人，否则不显示
                brokerUsers[broker.id]=res;//存储对应的用户详情
                insertItem();
            }
        }, "GET",{},header);
    }else{//否则不加载用户
        //do nothing
    }
}

//将item显示到页面
function insertItem(){
    // 加载内容
    var item = items[num-1];

    var brokerUser = item;//brokerUsers[item.id];//性能优化，不从nosql加载用户详情

    //仅显示已激活下级团队：至少使用一次，已经获得微信信息
    if(brokerUser&&brokerUser.nickname){
        //计算文字高度：按照1倍行距计算
        //console.log("orgwidth:"+orgWidth+"orgHeight:"+orgHeight+"width:"+imgWidth+"height:"+imgHeight);
        var image = "<img src='"+(brokerUser.avatarUrl?brokerUser.avatarUrl:(brokerUser.headImgUrl?brokerUser.headImgUrl:"../images/avatar/default.jpg"))+"' width='50' height='50'  class='persona-logo' alt=''/>";
            //**
        var tagTmpl = "<a class='persona-tag' href='#'>__TAG</a>";
        var tags = "<div class='persona-tags'>";
        var taggingList = [];
        //加载等级：需要查询对应的badge等级
        //taggingList.push(item.level);
        var badge = badges.find(item => item.badge.level == brokerUser.level);
        if(badge){
            taggingList.push(badge.name);
        }
        if(brokerUser.province)taggingList.push(brokerUser.province);
        if(brokerUser.city)taggingList.push(brokerUser.city);
        for(var t in taggingList){
            var txt = taggingList[t];
            if(txt && txt.trim().length>1 && txt.trim().length<8){
                tags += tagTmpl.replace("__TAGGING",txt).replace("__TAG",txt);
            }
        }
        tags += "</div>";
        //**/
        //电话：便于主动发起联系
        var phone = "<div class='persona-description' style='line-height:6px;'>&nbsp;&nbsp;</div>";
        if(item.phone){
            phone = "<div class='persona-description'>电话："+item.phone+"</div>";
        }

        //加入时间
        var joinTime  = "<div class='persona-description'>"+ item.createDate +"</div>";
        //真实姓名：
        var realname = "";
        if( item.name && item.name.trim().length>0 ){
            realname = "("+item.name+")";
        }
        //var title = "<div class='persona-title'>"+(item.name?item.name:faker.name.findName())+(brokerUser.nickname?("("+brokerUser.nickname+")"):"")+"</div>"
        var title = "<div class='persona-title'>"+(brokerUser.nickname?brokerUser.nickname:faker.name.findName())+realname+"</div>"
        //var description = "<div class='description'>"+(brokerUser.province?brokerUser.province:"")+(brokerUser.city?(" "+brokerUser.city):"")+"</div>"
        //var description = "<div class='description'>等级："+item.level+"</div>"
        //$("#waterfall").append("<li><div class='persona' data='"+item._key+"'><div class='persona-logo'>" + image +"</div><div class='persona-info'>" +title +phone+description+ "</div></li>");
        $("#waterfall").append("<li><div class='persona' data='"+item._key+"'><div class='persona-logo-wrapper'>" + image +"</div><div class='persona-info'>" +title +joinTime+ tags+ "</div><div class='persona-action'>&gt;</div></li>");

        //注册事件
        $("div[data='"+item.id+"']").click(function(){
            //点击后跳转到对应用户推荐界面？
        });
    }
    num++;//下标加一
    loading = false;// 表示加载结束
}

//load person
function loadPerson(personId) {
    console.log("try to load person info.",personId);
    util.AJAX(app.config.data_api+"/user/users/"+personId, function (res) {
        console.log("load person info.",personId,res);
        userInfo = res;
        currentPerson = res._key;
        //insertPerson(userInfo);//TODO:当前直接显示默认信息，需要改进为显示broker信息，包括等级、个性化logo等
        loadItems();//加载下级达人列表
        loadBrokerByOpenid(res._key);//根据openid加载broker信息
    });
}

//更新Broker
function updateBroker(broker) {
    console.log("try to update broker.[broker]",broker);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/"+broker.id, function (res) {
        console.log("update broker successfully.",res);
    },"PUT",broker,{ "Content-Type":"application/json" });
}

//根据openid查询加载broker
function loadBrokerByOpenid(openid) {
    console.log("try to load broker info by openid.[openid]",openid);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/brokerByOpenid/"+openid, function (res) {
        console.log("load broker info.",openid,res);
        if (res.status) {
            insertBroker(res.data);//显示达人信息
            //二维码需要手动点击后显示，此处不自动加载
            /**
            if(res.data.qrcodeUrl && res.data.qrcodeUrl.indexOf("http")>-1){//如果有QRcode则显示
                showQRcode(res.data.qrcodeUrl);
            }else{//否则请求生成后显示
                requestQRcode(res.data);
            }
            //**/
        }
    });    
}

//请求生成二维码
function requestQRcode(broker) {
    console.log("try to request QRCode.[broker]",broker);
    util.AJAX(app.config.auth_api+"/wechat/ilife/qrcode?brokerId="+broker.id, function (res) {
        console.log("Generate QRCode successfully.",res);
        if (res.status) {
            showQRcode(res.data.url);//显示二维码
            //将二维码URL更新到borker
            broker.qrcodeUrl = res.data.url;
            updateBroker(broker);
        }
    });
}

//显示二维码
function showQRcode(url) {
    $("#qrcode").html('<img src="'+url+'" width="200px" alt="分享二维码邀请更多成员加入"/>');
}

//显示没有更多内容
function shownomore(flag){
  if(flag){
    $("#footer").toggleClass("footer-hide",false);
    $("#footer").toggleClass("footer-show",true);
  }else{
    $("#footer").toggleClass("footer-hide",true);
    $("#footer").toggleClass("footer-show",false);
  }
}

//显示正在加载提示
function showloading(flag){
  if(flag){
    $("#loading").toggleClass("loading-hide",false);
    $("#loading").toggleClass("loading-show",true);
  }else{
    $("#loading").toggleClass("loading-hide",true);
    $("#loading").toggleClass("loading-show",false);    
  }
}

function htmlItemImage(item){
    var html = '';
    html += '<div class="mainbody">';
    html += '<img class="WxMasonryImage" id="'+item._key+'" src="'+item.images[0]+'" width="100%" height="200px" />';
    html += '</div>';
    return html;
}

function changeActionType (e) {
    console.log("now try to change action type.",e);
    //首先清除原来高亮状态
    if(currentActionType.trim().length>0){
        $("#"+currentActionType+" img").attr("src","images/"+currentActionType+".png"); 
        $("#"+currentActionType+" div").removeClass("actiontype-selected");
        $("#"+currentActionType+" div").addClass("actiontype");  
    }  
    //更改并高亮显示
    currentActionType = e.currentTarget.id;
    tagging = e.currentTarget.dataset.tagging;
    if (app.globalData.isDebug) console.log("User::ChangeActionType change action type.",currentActionType,tagging);
    if(currentActionType.trim().length>0){
        $("#"+currentActionType+" img").attr("src","images/"+currentActionType+"-selected.png"); 
        $("#"+currentActionType+" div").removeClass("actiontype");
        $("#"+currentActionType+" div").addClass("actiontype-selected");  
    } 

    //跳转到相应页面
    window.location.href = currentActionType+".html";
}

