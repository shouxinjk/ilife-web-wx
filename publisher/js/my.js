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

    //计算图片流宽度：根据屏幕宽度计算，最小显示2列
    if(width < 2*columnWidth){//如果屏幕不能并排2列，则调整图片宽度
        //columnWidth = (width-columnMargin*4)/2;//由于每一个图片左右均留白，故2列有4个留白
    }
    var args = getQuery();//获取参数
    $('#waterfall').NewWaterfall({
        width: columnWidth,
        delay: 100,
    });

    //显示加载状态
    showloading(true);
    //处理参数
    var args = getQuery();//获取参数
    if(args["id"]){
        currentPerson = args["id"]; //如果传入参数则使用传入值
    }
    if(args["filter"]){
        filter = args["filter"]; //如果传入参数则使用传入值：all、byBroker
    }
    if(args["byOpenid"]){
        byOpenid = args["byOpenid"]; //支持传入publisherOpenid
    }    

    $("body").css("background-color","#fff");//更改body背景为白色

    //加载达人信息
    loadBrokerInfo();

    loadPerson(currentPerson);//加载用户

    //注册事件：切换操作类型
    $(".order-cell").click(function(e){
        changeActionType(e);
    });

    //注册点击创建按钮事件 ：显示表单
    $("#createArticleBtn").click(function(e){
        showArticleForm();
    });
    //点击购买按钮：创建支付信息并发起微信支付
    $("#btnPurchase").click(function(e){
        createPayInfo();
    });
    //点击取消按钮：清空已选广告列表、清空已售列表、解除锁屏
    $("#btnQuitPurchase").click(function(e){
        clearAds();
        $.unblockUI(); 
    });    
    
    //检查是否有缓存事件
    resultCheck();

    //查询文章总数及阅读总数
    countReadmeTotal();//查询阅读总数
    countArticleTotal();//查询文章总数

    //加载广告位：仅加载可用广告位
    loadAds();

});

util.getUserInfo();//从本地加载cookie

var byOpenid = null;

//设置默认logo
var logo = "https://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg";

var columnWidth = 800;//默认宽度600px
var columnMargin = 5;//默认留白5px
var loading = false;
var dist = 500;
var num = 1;//需要加载的内容下标

var filter = "all";//my、all。数据查询规则：默认为查询全部

var items = [];//所有画像列表
var page = {
    size:10,//每页条数
    total:1,//总页数
    current:-1//当前翻页
};

var currentActionType = '';//当前操作类型
var tagging = '';//操作对应的action 如buy view like 等

var currentPerson = app.globalData.userInfo?app.globalData.userInfo._key:null;
var userInfo=app.globalData.userInfo;//默认为当前用户

var currentBroker = null;
var broker = {};//当前达人

var sxTimer = null;
var sxStartTimestamp=new Date().getTime();//定时器如果超过2分
var sxLoopCount = 1000;//定时器运行100次即停止，即30秒

//优先从cookie加载达人信息
function loadBrokerInfo(){
  broker = util.getBrokerInfo();
  currentBroker = broker.id;
}

function registerTimer(brokerId){
    currentBroker = brokerId;
    sxTimer = setInterval(function ()
    {
        //console.log("Articles::registerTimer.");
        if ($(window).scrollTop() >= $(document).height() - $(window).height() - dist && !loading)
        {
            console.log("Articles::registerTimer start load article.");
            // 表示开始加载
            loading = true;
            showloading(true);

            // 加载内容
            if(items.length < num){//如果内容未获取到本地则继续获取
                console.log("request articles from server side.");
                //读取待阅读列表
                loadItems();
                //有用户操作则恢复计数器
                console.log("reset loop count.");
                sxLoopCount = 100;                
            }else{//否则使用本地内容填充
                console.log("insert article item from locale.");
                insertItem();
            }
        }

        //计数器自减，到时即停止
        /**
        if(--sxLoopCount<0){
            unregisterTimer();
        }
        //**/
    }, 100);
}

function unregisterTimer(){
    console.log("clear timer.");
    clearInterval(sxTimer);
}


/*
根据当前用户openid加载已发布文章列表：按照最后修改时间倒序排列
*/
function loadItems(){
    util.AJAX(app.config.sx_api+"/wx/wxArticle/rest/my-articles/"+userInfo._key, function (res) {
        showloading(false);
        console.log("Publisher::Articles::loadItems try to retrive my articles.", res)
        if(res && res.length==0){//如果没有画像则提示，
            shownomore();
        }else{//否则显示到页面
            //更新当前翻页
            page.current = page.current + 1;
            //装载具体条目
            var hits = res;
            for(var i = 0 ; i < hits.length ; i++){
                items.push(hits[i]);
            }
            insertItem();
        }
    }, 
    "GET",
    {
        from:(page.current+1)*page.size,
        to:(page.current+1)*page.size+page.size
    },
    {});
}

//将item显示到页面
function insertItem(){
    // 加载内容
    var item = items[num-1];
    if(!item){
        shownomore(true);
        return;
    }

    //文章无logo，随机指定一个。设置为发布者LOGO，或者直接忽略
    logo = "https://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg";
    //由于微信禁止，无法直接使用封面图，需要使用达人图片
    /**
    if(item.coverImg){
        logo = item.coverImg;
    }
    //**/
    //判断有无置顶广告位
    var tags = "";
    if(item.advertise){//如果有广告位则显示置顶
        tags += "<span style='margin:2px auto;padding:2px;border:1px solid red;color:red;border-radius:16px;font-size:12px;line-height:20px;'>置顶</span>";
    }
    tags += "<span style='margin-right:5px;padding:0 2px;border:1px solid red;color:red;border-radius:5px;font-size:12px;line-height:16px;'>置顶</span>";
    var advertise = "<img src='https://www.biglistoflittlethings.com/ilife-web-wx/images/rocket.png' width='16' height='16'/>&nbsp;";

    var title = "<div class='title'>"+item.title+"</div>";
    var image = "<img src='"+logo+"' style='width:60px;object-fit:cover;'/>";
    var description = "<div class='description'>"+item.updateDate+"</div>";

    var btns = "";
    //置顶：购买广告位
    btns += '<button type="submit" class="action-tag-orange" id="btnTopping'+item.id+'">置顶</button> ';   
    //顶一下：用阅豆临时置顶，时间10分钟
    btns += '<button type="submit" class="action-tag-orange" id="btnCall'+item.id+'">顶一下</button> ';      
    //上架、下架
    if(item.status=="active"){
        btns += '<button type="submit" class="action-tag-black" id="btnDeactive'+item.id+'">下架</button> ';
        btns += '<button type="submit" class="action-tag-orange" style="display:none" id="btnActive'+item.id+'">上架</button> ';
    }else{
        btns += '<button type="submit" class="action-tag-black" style="display:none" id="btnDeactive'+item.id+'">下架</button> ';
        btns += '<button type="submit" class="action-tag-orange" id="btnActive'+item.id+'">上架</button> ';
    }
    //置顶明细：弹出显示置顶明细列表，包括置顶及顶一下
    btns += '<button type="submit" class="action-tag-black" id="btnToppingHistory'+item.id+'">置顶明细</button> ';   
    //开白明细：弹出显示开白明细列表
    btns += '<button type="submit" class="action-tag-black" id="btnForwardList'+item.id+'">开白明细</button> ';           
    //报数明细：能够查看报数历史
    btns += '<button type="submit" class="action-tag-black" id="btnReadHistory'+item.id+'">报数明细</button> ';     
    var btnsDiv = "<div class='btns' style='display:flex;flex-direction:row;flex-wrap:nowrap;margin-top:5px;'>"+btns+"</div>";    

    var seperator = "";
    if(num>1)
        seperator = "<div class='item-separator' style='border-radius:0'></div>";

    $("#waterfall").append("<li>"+seperator+"<div class='task' data='"+item.id+"' data-title='"+item.title+"' data-url='"+item.url+"'><div class='task-logo'>" + image +"</div><div class='task-tags'>" +title +description+btnsDiv+"</div></li>");
    num++;

    //注册事件
    $("#btnDeactive"+item.id).click(function(){ //下架      
        changeArticleStatus($(this).attr("id").replace(/btnDeactive/,""),"inactive");
    });
    $("#btnActive"+item.id).click(function(){ //上架   
        changeArticleStatus($(this).attr("id").replace(/btnActive/,""),"active");
    });       
    $("#btnTopping"+item.id).click(function(){ //无敌置顶：要花钱的那种 
        loadSoldAds($(this).attr("id").replace(/btnTopping/,""));//需要传递当前文章ID
    }); 
    // 表示加载结束
    loading = false;
}

//修改文章状态
function changeArticleStatus(articleId,status){
    console.log("try to change article status.",userInfo._key);
    $.ajax({
        url:app.config.sx_api+"/wx/wxArticle/rest/article/"+articleId+"/"+status,
        type:"post",
        success:function(res){
            console.log("status changed.",res);
            if(res.status){//修改按钮状态
                if(status=="active"){
                    $("#btnDeactive"+articleId).css("display","block");
                    $("#btnActive"+articleId).css("display","none");
                }else{
                    $("#btnDeactive"+articleId).css("display","none");
                    $("#btnActive"+articleId).css("display","block");
                }
            }
        }
    })   
}

//load person
function loadPerson(personId) {
    console.log("try to load person info.",personId);
    util.AJAX(app.config.data_api+"/user/users/"+personId, function (res) {
        console.log("load person info.",personId,res);
        userInfo = res;
        currentPerson = res._key;
        insertPerson(userInfo);//TODO:当前直接显示默认信息，需要改进为显示broker信息，包括等级、个性化logo等
        //loadData();
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
            $.cookie('sxBroker', JSON.stringify(res.data), {  path: '/' });     
            broker = res.data; 
            insertBroker(res.data);//显示达人信息
            registerTimer(res.data.id);//加载该达人的board列表
        }
    });
}

function insertPerson(person){
    // 显示HTML
    var html = '';
    html += '<div class="info-general">';
    html += '<img class="general-icon" src="'+person.avatarUrl+'" height="60px"/>';
    html += '</div>';
    html += '<div class="info-detail">';
    html += '<div class="info-text info-blank">'+person.nickName+'</div>';
    html += '<div class="info-text info-blank" id="brokerHint">'+(person.province?person.province:"")+(person.city?(" "+person.city):"")+'</div>';
    html += '<div class="info-text info-blank" id="brokerLink"><a href="../user.html">返回用户后台</a></div>';
    html += '</div>';
    $("#user").append(html);
}

function insertBroker(broker){
    $("#brokerHint").html("流量主");
}

//显示没有更多内容
function shownomore(flag){
  if(flag){
    unregisterTimer();
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

//检查阅读效果：如果检查到有cookie，则显示阅读数确认框
function resultCheck(){
    var articleInfo = $.cookie('sxArticle');
    console.log("load articleInfo from cookie.",articleInfo);
    if(articleInfo && articleInfo.trim().length>0){
        console.log("get articleInfo info from cookie.",articleInfo);
        var article = JSON.parse(articleInfo);
        //检查时间是否已达到10秒
        var duration = new Date().getTime() - Number(article.startTime);
        if( duration > 10000){
            //显示数据填报表单
            $.blockUI({ message: $('#checkform'),
                css:{ 
                    padding:        10, 
                    margin:         0, 
                    width:          '60%', 
                    top:            '40%', 
                    left:           '20%', 
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
            $("#btnNo").click(function(){
                $.cookie('sxArticle', "", { path: '/' }); //清除cookie重新来过
                $.unblockUI(); 
            });
            $("#btnYes").click(function(){//完成阅读后的奖励操作
                //检查数字：必填。TODO：此处需要判断是否胡乱填报
                var readCount = Number($("#viewNumbers").val());
                if(readCount <=0 ){
                    $("#viewNumbers").css("border","1px solid red");
                }else{
                    console.log("try to submit read event.");
                    $.cookie('sxArticle', "", { path: '/' }); //清除cookie重新来过
                    costPoints(article);
                }
            });
        }else{//提示超过10秒才可以
            console.log("不到10秒，不能奖励",duration/1000);
            siiimpleToast.message('亲，要超过10秒才能奖励阅豆哦~~',{
                  position: 'bottom|center'
                });
            //清除cookie重新来过
            $.cookie('sxArticle', "", { path: '/' });  
        }
    }else{
      console.log("no article from cookie.",articleInfo);
    }
}

//完成阅读扣除及奖励
function costPoints(article){
    //先扣除阅豆
    console.log("try to commit read event.",userInfo._key);
    $.ajax({
        url:app.config.sx_api+"/wx/wxArticle/rest/exposure/"+article.id+"/"+userInfo._key,
        type:"post",
        success:function(res){
            console.log("cost point succeed.",res);
            logPointCostEvent(article,res);//记录本次阅读历史
            //解除屏幕锁屏
            $.unblockUI(); 
        }
    })      
}

//记录文章阅读历史：publisher内包含有文章发布者信息：openid,brokerId,nickname,avatarUrl 消耗的点数points
//需要补全：阅读者openid，nickname，avatarUrl，阅读时间，阅读报数，文章ID
//记录ID为：文章ID+阅读者openid md5
function logPointCostEvent(article,publisher){
    var readCount = Number($("#viewNumbers").val());
    $("#viewNumbers").css("border","1px solid silver");//恢复标准风格
    $("#viewNumbers").val("");//清空原有数值，避免交叉
    $.ajax({
        url:app.config.analyze_api+"?query=insert into ilife.reads values ('"+hex_md5(article.id+userInfo._key)+"','"+
            publisher.openid+"','"+
            publisher.brokerId+"','"+
            publisher.nickname+"','"+
            publisher.avatarUrl+"','"+
            userInfo._key+"','"+
            userInfo.nickname+"','"+
            userInfo.avatarUrl+"','"+
            article.id+"','"+
            article.title+"','"+
            article.url+"',"+
            publisher.points+","+readCount+",now())",
        type:"post",
        //data:{},
        headers:{
            "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
        },         
        success:function(json){
            console.log("===reads inserted===\n",json);
            //从当前列表中删除该文章
            $("div[data='"+article.id+"']").remove();
        }
    });     
}


//显示发布文章表单
function showArticleForm(){
    console.log("show article form.");
    //显示数据填报表单
    $.blockUI({ message: $('#articleform'),
        css:{ 
            padding:        10, 
            margin:         0, 
            width:          '60%', 
            top:            '40%', 
            left:           '20%', 
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
    $("#btnCancel").click(function(){
        $("#articleUrl").css("border","1px solid silver");//恢复标准风格
        $("#articleUrl").val("");//清空原有数值，避免交叉        
        $.unblockUI(); //直接取消即可
    });
    $("#btnPublish").click(function(){//完成阅读后的奖励操作
        //检查数字url，胡乱填写不可以
        if( !isUrlValid($("#articleUrl").val()) ){
            $("#articleUrl").css("border","1px solid red");
            $("#articleUrl").val("");//清空原有数值，避免交叉
        }else{
            console.log("try to submit read event.");
            submitArticle();
        }
    });
}

//检查url是否符合要求：仅支持微信公众号文章
//https://mp\.weixin\.qq\.com/s/[-a-zA-Z0-9+&@#/%?=~_|!:,.;]*[-a-zA-Z0-9+&@#/%=~_|]
/**
function isUrlValid(url) {
    return /^(https?|s?ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i.test(url);
}
//**/
function isUrlValid(url) {
    return /^https:\/\/mp\.weixin\.qq\.com\/s\/[-a-zA-Z0-9+&@#/%?=~_|!:,.;]*[-a-zA-Z0-9+&@#/%=~_|]$/i.test(url);
}

//添加文章：获取文章url并提交
function submitArticle(){
    var url = $("#articleUrl").val();
    $("#articleUrl").css("border","1px solid silver");//恢复标准风格
    $("#articleUrl").val("");//清空原有数值，避免交叉
    if(!broker){//如果broker不存在，则传递openid，后台会默认创建
        broker = {
            openid:userInfo._key,
            nickname:userInfo.nickName?userInfo.nickName:""
        };
    }else if(!broker.id){//如果没有id，也设置openid
        broker.openid = userInfo._key;
        broker.nickname = userInfo.nickName?userInfo.nickName:"";
    }
    $.ajax({
        url:app.config.sx_api+"/wx/wxArticle/rest/article",
        type:"post",
        data:JSON.stringify({
            url:url,
            broker:broker,
        }),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },        
        success:function(res){
            console.log("article submit succeed.",res);
            $.unblockUI(); //屏幕解锁
            //将文章显示在自己列表顶部
            if(res.status){//提示文章已发布
                if(res.code&&res.code=="duplicate"){
                    siiimpleToast.message('文章已存在，不需要重复发布哦~~',{
                          position: 'bottom|center'
                        });  
                }else{
                    toppingItem(res.data);//将文章显示到界面
                    siiimpleToast.message('发布成功，阅豆越多排名越靠前哦~~',{
                          position: 'bottom|center'
                        });  
                }   
            }      
        }
    })     
}

//手动置顶指定文章
function toppingItem(item){
    if(!item || !item.id){
        console.log("wrong article");
        return;
    }
    //文章无logo，随机指定一个。设置为发布者LOGO，或者直接忽略
    logo = "https://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg";
    //由于微信禁止，无法直接使用封面图，需要使用达人图片
    /**
    if(item.coverImg){
        logo = item.coverImg;
    }
    //**/
    //新文章默认显示到顶部：仅在发布者界面
    var tags = "<span style='margin-right:5px;padding:0 2px;border:1px solid red;color:red;border-radius:5px;font-size:12px;line-height:16px;'>新文首发</span>";
    var advertise = "";

    var title = "<div class='title'>"+tags+item.title+advertise+"</div>";
    var image = "<img src='"+logo+"' style='width:60px;object-fit:cover;'/>";
    var description = "<div class='description'>"+item.updateDate+"</div>";

    var btns = "";
    //置顶：购买广告位
    btns += '<button type="submit" class="action-tag-orange" id="btnTopping'+item.id+'">置顶</button> ';   
    //顶一下：用阅豆临时置顶，时间10分钟
    btns += '<button type="submit" class="action-tag-orange" id="btnCall'+item.id+'">顶一下</button> ';       
    //上架、下架
    if(item.status=="active"){
        btns += '<button type="submit" class="action-tag-black" id="btnDeactive'+item.id+'">下架</button> ';
        btns += '<button type="submit" class="action-tag-orange" style="display:none" id="btnActive'+item.id+'">上架</button> ';
    }else{
        btns += '<button type="submit" class="action-tag-black" style="display:none" id="btnDeactive'+item.id+'">下架</button> ';
        btns += '<button type="submit" class="action-tag-orange" id="btnActive'+item.id+'">上架</button> ';
    }
    //置顶明细：弹出显示置顶明细列表，包括置顶及顶一下
    btns += '<button type="submit" class="action-tag-black" id="btnToppingHistory'+item.id+'">置顶明细</button> ';   
    //开白明细：弹出显示开白明细列表
    btns += '<button type="submit" class="action-tag-black" id="btnForwardList'+item.id+'">开白明细</button> ';      
    //报数明细：能够查看报数历史
    btns += '<button type="submit" class="action-tag-black" id="btnReadHistory'+item.id+'">报数明细</button> ';     
    var btnsDiv = "<div class='btns' style='display:flex;flex-direction:row;flex-wrap:nowrap;margin-top:5px;'>"+btns+"</div>";    

    var seperator = "<div class='item-separator' style='border-radius:0'></div>";

    $("#createArtileEntry").after("<li><div class='task' data='"+item.id+"' data-title='"+item.title+"' data-url='"+item.url+"'><div class='task-logo'>" + image +"</div><div class='task-tags'>" +title +description+btnsDiv+"</div>"+seperator+"</li>");

    //注册事件
    $("div[data='"+item.id+"']").click(function(){
        //cookie缓存记录当前浏览文章，返回时检查
        console.log("Publisher::Articles now jump to article.");
        var expDate = new Date();
        expDate.setTime(expDate.getTime() + (60 * 1000)); // 60秒钟后自动失效：避免用户直接叉掉页面不再回来    
        var readingArticle = {
            id:$(this).attr("data"),//文章id
            title:$(this).attr("data-title"),//文章标题
            url:$(this).attr("data-url"),//文章URL
            startTime: new Date().getTime()//开始时间戳：需要超过10秒
        };
               
        console.log("Publisher::Articles save article to cookie.",readingArticle);
        $.cookie('sxArticle', JSON.stringify(readingArticle), { expires: expDate, path: '/' });  //把浏览中的文章id写入cookie便于记录阅读数       

        //跳转到原始页面完成阅读
        console.log("Publisher::Articles now jump to article.");
        //window.location.href = "../index.html";   
        window.location.href = $(this).attr("data-url");          

    });
}

//查询阅我总数：排除自己的阅读
var totalReadme = 0;
function countReadmeTotal(){
    $.ajax({
        url:app.config.analyze_api+"?query=select count(eventId) as totalCount from ilife.reads where publisherOpenid='"+userInfo._key+"' and readerOpenid!='"+userInfo._key+"' format JSON",
        type:"get",
        //async:false,
        //data:{},
        headers:{
            "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
        },         
        success:function(res){
            console.log("Publisher::My::countReadmeTotal try to retrive readme count.", res)
            if(res && res.rows==0){//无法回直接忽略
                //do nothing
            }else{//如果大于0则更新到页面
                //if(res.data[0].totalCount>0){
                    var oldTxt = $("#myArticleFilter").text();
                    totalReadme = res.data[0].totalCount;
                    $("#myArticleFilter").text("文章(总"+totalArticles+"阅"+totalReadme+")");
                //}
            }
        }
    }); 
}

//查询文章总数
var totalArticles = 0;
function countArticleTotal(){
    $.ajax({
        url:app.config.sx_api+"/wx/wxArticle/rest/total-articles/"+userInfo._key,
        type:"get",        
        success:function(res){
            console.log("got article count.",res);
            if(res.status && res.count){//显示到界面
                var oldTxt = $("#myArticleFilter").text(); 
                totalArticles = res.count;
                $("#myArticleFilter").text("文章(总"+totalArticles+"阅"+totalReadme+")");             
            }      
        }
    }) 
}

//加载显示广告位：查询可用广告位后按照日期、时间段展示
var selectedAds = {};//记录选中的广告价格明细：key为广告位分组，组织形式：日期__广告位ID；价格为单一数值
//var selectedAdNames = {};//记录选中的广告位明细：key为广告位分组，组织形式：日期__广告位ID；名称为：日期-时间-广告位
var allAds = [];//所有可用广告位列表。提前加载后缓存，显示时需要根据购买情况过滤。是json对象数组
var soldAds = [];//已售卖广告位列表。在显示前直接查询得到。是单值组织的广告位，组织形式：日期__广告位ID
function loadAds(){
    //查询得到文章置顶广告位
    $.ajax({
        url:app.config.sx_api+"/wx/wxAdvertise/rest/ads/article",
        type:"get",        
        success:function(res){
            console.log("got available article ads.",res);
            allAds = res;
            //注意：此处仅提前加载所有广告位清单。用户点击后才查询已售广告位，并显示到界面
            //showAds(res); //根据返回的广告位列表展示：包括3个连续日期。TODO：由于需要检查购买情况，在触发置顶操作后再显示
        }
    }) 
}

//加载已购买广告位：需要一次性查询连续3天的已购买情况
//直接返回所有已购买列表：需要组装为可检索模式
var tmpAdQuantity = {};//记录可重复售卖广告的quantity，key为 展示日期+广告位ID，形式为2022-04-01xxxxxx，value为 quantity
var tmpAdSoldCount = {};//记录可重复售卖广告的实际售卖数量，key为 展示日期+广告位ID，形式为2022-04-01xxxxxx，，value为 sold。该值需要统计得到
var toppingArticleId = null;//记录当前待置顶文章ID
function loadSoldAds(articleId){
    console.log("try to check ads for article.",articleId);
    toppingArticleId = articleId;
    //查询得到临近3天的已售卖广告位
    $.ajax({
        url:app.config.sx_api+"/wx/wxPaymentAd/rest/sold-in-advance/3",//需要取几天可直接传递
        //async:false,//注意是同步调用
        type:"get",        
        success:function(res){
            console.log("got sold ads.",res);
            //需要过滤。根据quantity进行。对于quantity为1的，直接组装广告位加入soldAds列表，对于quantity>1的情况，需要通过缓存计算后判定
            res.forEach(function(json){
                var adId = json.advertiseDate+json.advertise.id; //将展示日期及广告位ID组合作为唯一识别码，形式：2020-04-01xxxxxx
                if(json.advertise.quantity==1){//仅有一个广告位的情况，直接加入已售完列表
                    soldAds.push(adId);
                }else if(json.advertise.quantity>1){//加入临时存储，需要进行统计计算
                    tmpAdQuantity[adId]=json.advertise.quantity;//记录广告位可卖数量
                    //累计该广告位的实际售卖数量
                    if(!tmpAdSoldCount[adId]){
                        tmpAdSoldCount[adId] = 1;
                    }
                    tmpAdSoldCount[adId] = tmpAdSoldCount[adId] + 1;
                    console.log("tmpAdSoldCount",tmpAdSoldCount);
                    //判断是否已经达到可售数量
                    if(tmpAdSoldCount[adId]>=json.advertise.quantity){//加入已售完列表
                        soldAds.push(adId);
                    }
                }else{//其他直接忽略
                    //数量小于1？
                }
            });
            //显示广告到界面
            showAds(articleId);
        }
    }) 
}

//将广告显示到界面，供选择
//遍历availableAds，逐条显示：先根据时间段判断对应时段div是否已存在，否的话直接添加，然后在时间段下添加广告位
//对于当前日期：当前时间以前的均不显示，仅显示当前时间以后的。区分可买与已售
//对于其他日期：显示所有条目，区分可买与已售
//点选事件：点选后需要更新广告位记录，包括日期、广告位ID、价格；及名称。点选后需要汇总所有已选中广告价格
function showAds(){
    //得到连续3天的时间
    var preSaleDates = [];
    var currentTimestamp = new Date().getTime();//获取毫秒时间
    preSaleDates.push(new Date(currentTimestamp));//今天
    preSaleDates.push(new Date(currentTimestamp+24*60*60*1000));//明天
    preSaleDates.push(new Date(currentTimestamp+2*24*60*60*1000));//后天

    //将日期映射到：今天、明天、后天，与展示元素标签对应
    var dateMapping = {};
    dateMapping[DateFormatter.format('%m-%d', new Date(currentTimestamp))] = "today";
    dateMapping[DateFormatter.format('%m-%d', new Date(currentTimestamp+24*60*60*1000))] = "tomorrow";
    dateMapping[DateFormatter.format('%m-%d', new Date(currentTimestamp+2*24*60*60*1000))] = "aftertomorror";

    //根据广告位逐条、逐天显示
    allAds.forEach(function(item){
        //console.log("try show ad.",item);
        //逐天显示
        preSaleDates.forEach(function(dateEntry){
            //根据指定日期，以及广告时间段组装开始时间
            //开始时间
            var advertiseDate = dateEntry;
            var advertiseTime = item.timeSlotFrom.split(":");//显示形式为00:00:00，取前两段即可
            advertiseDate.setHours(Number(advertiseTime[0]));
            advertiseDate.setMinutes(Number(advertiseTime[1]));
            advertiseDate.setSeconds(Number(advertiseTime[2]));
            //结束时间
            //var advertiseDate2 = dateEntry;//如果多个对象引用dateEntry，数据会被覆盖，需要重新构建对象
            var advertiseDate2 = new Date();
            advertiseDate2.setFullYear(dateEntry.getFullYear());
            advertiseDate2.setMonth(dateEntry.getMonth());
            advertiseDate2.setDate(dateEntry.getDate());
            var advertiseTime2 = item.timeSlotTo.split(":");//显示形式为00:00:00，取前两段即可
            advertiseDate2.setHours(Number(advertiseTime2[0]));
            advertiseDate2.setMinutes(Number(advertiseTime2[1]));
            advertiseDate2.setSeconds(Number(advertiseTime2[2]));        
            //判断是否是未来时间    
            if(advertiseDate.getTime()>new Date().getTime()){//仅对未来时间展示
                //检查所在分组的时间段是否已显示
                var advertiseTimeSlotKey = DateFormatter.format('%m-%d-%H-%i-%s', advertiseDate);
                //console.log("advertiseDate",advertiseDate,item.timeSlotFrom);
                //console.log("advertiseDate2",advertiseDate2,item.timeSlotTo);
                var advertiseTimeSlotName = DateFormatter.format('%m-%d %H:%i', advertiseDate)+"至"+DateFormatter.format('%H:%i', advertiseDate2);//显示为：02-03 07:00至08:00
                if ($('#slotWrapper'+advertiseTimeSlotKey).length <= 0) { //如果不存在则创建
                    var advertiseTimeSlotHtml = "<div id='slotWrapper"+advertiseTimeSlotKey+"'><div class='adslot-name' id='slotName"+advertiseTimeSlotKey+"'>"+advertiseTimeSlotName+"</div><div class='adslot-grid' id='slot"+advertiseTimeSlotKey+"'></div></div>";
                    $("#tabs-"+dateMapping[DateFormatter.format('%m-%d', advertiseDate)]).append(advertiseTimeSlotHtml);
                }
                //显示可用广告位：显示为radio，id为slotkey+广告位id，group为slotkey
                var advertiseSpotKey = advertiseTimeSlotKey+item.id;
                var spotTips = "￥"+item.price;
                var disabled = "";
                //判断是否已售
                if(soldAds.indexOf(DateFormatter.format('%Y-%m-%d', advertiseDate)+item.id)>=0){//形式为 2020-04-01xxxxx
                    spotTips = "已抢";
                    if(item.quantity>1){//如果是多坑位
                        spotTips = "满坑";
                    }
                    disabled = "disabled";
                }
                var advertiseSpotHtml = "";
                advertiseSpotHtml += '<div class="adspot-block">';
                advertiseSpotHtml += '<input type="radio" class="adspot-input" id="'+advertiseSpotKey+'" data-adid="'+item.id+'" data-addate="'+DateFormatter.format('%Y-%m-%d', advertiseDate)+'" name="'+advertiseTimeSlotKey+'" value="'+item.price+'" '+disabled+'>';
                advertiseSpotHtml += '<label  class="adspot-label" for="'+advertiseSpotKey+'">'+item.name+" "+spotTips+'</label>';
                advertiseSpotHtml += '</div>';
                $("#slot"+advertiseTimeSlotKey).append(advertiseSpotHtml);
                
                //注册点击事件
                $("#"+advertiseSpotKey).click(function(){
                    console.log("choose advertise spot",$(this).attr("id"),$(this).val());
                    //更新到已选广告列表内
                    selectedAds[$(this).attr("id")]={
                        date:$(this).attr("data-addate"),//展示日期：2022-04-01
                        id:$(this).attr("data-adid"),//广告位ID
                        price:Number($(this).val())
                    };
                    //计算广告金额汇总
                    var totalAmount = 0;
                    for (var key in selectedAds){
                        totalAmount += selectedAds[key].price;
                        //处理四舍五入
                        totalAmount = Math.floor(totalAmount * 100) / 100;
                    }   
                    //更新到底部汇总区域
                    console.log("total amount calculated.",totalAmount);
                    $("#totalAmountTips").text("总计："+totalAmount);
                    $("#totalAmount").val(totalAmount);
                });
            }else{//直接忽略
                console.log("passed time. ignore.",advertiseDate);
            }
        });
    });

    //显示tabs
    $( "#adTabs" ).tabs();

    //显示广告购买表单
    $.blockUI({ message: $('#adPurchaseForm'),
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

//清空广告及显示：在点击取消或购买完成后均需清空
function clearAds(){
    selectedAds = {};//清空已选广告列表
    soldAds = [];//清空已售广告列表     
    tmpAdQuantity = {};//清空一位多卖记录
    tmpAdSoldCount = {};//清空一位多卖实际出售记录
    toppingArticleId = null;//清空当前文章ID
    $("#tabs-today").empty();
    $("#tabs-tomorrow").empty();
    $("#tabs-aftertomorror").empty();    
}

//下单：通过后台生成支付预订单，在获取prepay_id后调用js支付
function createPayInfo(){
    $.ajax({
        url:app.config.sx_api+"/wxPay/rest/payinfo",
        type:"post", 
        data:JSON.stringify({
            openid:userInfo._key,
            out_trade_no:hex_md5(userInfo._key+"article"+toppingArticleId+(new Date().getTime())),
            total_fee:Number($("#totalAmount").val())*100,//单位为分
            body:"内容展示及排序服务",
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
                //payOrder(res.data);
            }
        }
    }) 
}

//支付：发起微信支付提交购买。支付成功后创建购买记录
function payOrder(payInfo){
    wx.chooseWXPay({
      timestamp: 0, // 支付签名时间戳，注意微信jssdk中的所有使用timestamp字段均为小写。但最新版的支付后台生成签名使用的timeStamp字段名需大写其中的S字符
      nonceStr: '', // 支付签名随机串，不长于 32 位
      package: '', // 统一支付接口返回的prepay_id参数值，提交格式如：prepay_id=\*\*\*）
      signType: '', // 微信支付V3的传入RSA,微信支付V2的传入格式与V2统一下单的签名格式保持一致
      paySign: '', // 支付签名
      success: function (res) {
        // 支付成功后的回调函数
      }
    });
}

//创建已购买的广告位
//提交数据包括：达人ID或达人openid，文章ID，已选广告列表。支付结果数据
function submitPurchasedAds(){

}






