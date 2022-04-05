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
        filter = args["filter"]; //如果传入参数则使用传入值：byReadme, byReadta
    }

    $("body").css("background-color","#fff");//更改body背景为白色

    //加载达人信息
    loadBrokerInfo();

    loadPerson(currentPerson);//加载用户

    //注册事件：切换操作类型
    $(".order-cell").click(function(e){
        changeActionType(e);
    });

    //注册切换到 阅TA 
    $("#readta").click(function(e){
        window.location.href = "reads.html?filter=byReadta";
    });
    $("#readme").click(function(e){
        window.location.href = "reads.html?filter=byReadme";
    });    

    //根据filter切换界面高亮显示
    if(filter=="byReadta"){
        $("#readta").removeClass("filter");
        $("#readta").addClass("filter-selected");
        $("#readme").removeClass("filter-selected");
        $("#readme").addClass("filter");     
    }else{
        $("#readme").removeClass("filter");
        $("#readme").addClass("filter-selected");
        $("#readta").removeClass("filter-selected");
        $("#readta").addClass("filter"); 
    }
    
    //检查是否有缓存事件
    resultCheck();

    //检查汇总数据
    countReadmeTotal();
    countReadtaTotal();

});

util.getUserInfo();//从本地加载cookie

var filter="byReadme";// byReadme, byReadta 默认为 阅我

//设置默认logo
var logo = "https://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg";

var columnWidth = 800;//默认宽度600px
var columnMargin = 5;//默认留白5px
var loading = false;
var dist = 500;
var num = 1;//需要加载的内容下标

var items = [];//所有记录列表
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

var readmeMap = {};//以openid为键值，记录阅读过我的文章的用户及阅读数
var readtaMap = {};//以openid为键值，记录我阅读过该用户文章的阅读数

var sxTimer = null;
var sxStartTimestamp=new Date().getTime();//定时器如果超过2分
var sxLoopCount = 1000;//定时器运行100次即停止，即30秒

//优先从cookie加载达人信息
function loadBrokerInfo(){
  broker = util.getBrokerInfo();
  currentBroker = broker.id;
}

function getItemsQuery(){
    if(filter == "byReadta"){//指定为 阅TA：查询得到 reader的信息
        return "select DISTINCT ON (publisherOpenid,readerOpenid) eventId,publisherOpenid as openid,publisherNickname as nickname,publisherAvatarUrl as avatarUrl,articleTitle,readCount,ts from ilife.reads where publisherOpenid!='"+userInfo._key+"' and readerOpenid='"+userInfo._key+"' order by ts desc limit "+page.size+" offset "+ ((page.current+1)*page.size) +" format JSON";
    }else{//默认为 阅我：查询得到publisher的信息
        return "select DISTINCT ON (publisherOpenid,readerOpenid) eventId,readerOpenid as openid,readerNickname as nickname,readerAvatarUrl as avatarUrl,articleTitle,readCount,ts from ilife.reads where publisherOpenid='"+userInfo._key+"' and readerOpenid!='"+userInfo._key+"' order by ts desc limit "+page.size+" offset "+ ((page.current+1)*page.size) +" format JSON";
    }
}

function registerTimer(brokerId){
    currentBroker = brokerId;
    sxTimer = setInterval(function ()
    {
        //console.log("Articles::registerTimer.");
        if ($(window).scrollTop() >= $(document).height() - $(window).height() - dist && !loading)
        {
            console.log("Articles::registerTimer start load boards.");
            // 表示开始加载
            loading = true;
            showloading(true);

            // 加载内容
            if(items.length < num){//如果内容未获取到本地则继续获取
                //读取待阅读列表
                loadItems();
                //有用户操作则恢复计数器
                console.log("reset loop count.");
                sxLoopCount = 100;                
            }else{//否则使用本地内容填充
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
加载待阅读文章列表：
按照阅豆高低倒序排列得到最新文章列表
*/
function loadItems(){
    //查询阅读当前用户文章的事件列表
    $.ajax({
        url:app.config.analyze_api+"?query="+getItemsQuery(),
        type:"get",
        //data:{},
        headers:{
            "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
        },         
        success:function(res){
            showloading(false);
            console.log("Publisher::Reads::loadItems try to retrive read record items.", res)

            if(res && res.rows==0){//如果没有画像则提示，
                shownomore();
                if(!items || items.length==0){
                    $("#Center").append("<div style='font-size:12px;line-height:24px;width:100%;text-align:center;'>还没有记录哦~~</div>");
                }                
            }else{//否则显示到页面
                //更新当前翻页
                page.current = page.current + 1;
                //装载具体条目
                var hits = res.data;
                for(var i = 0 ; i < hits.length ; i++){
                    items.push(hits[i]);
                }
                insertItem();
            }
        }
    }); 
}

//查询阅我总数：排除自己的阅读
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
            console.log("Publisher::Reads::countReadmeTotal try to retrive readme count.", res)
            if(res && res.rows==0){//无法回直接忽略
                //do nothing
            }else{//如果大于0则更新到页面
                if(res.data[0].totalCount>0){
                    var oldTxt = $("#readme").text();
                    $("#readme").text(oldTxt+"("+res.data[0].totalCount+")")
                }
            }
        }
    }); 
}

//查询阅TA总数：排除自己的文章
function countReadtaTotal(){
    $.ajax({
        url:app.config.analyze_api+"?query=select count(eventId) as totalCount from ilife.reads where readerOpenid='"+userInfo._key+"' and publisherOpenid!='"+userInfo._key+"' format JSON",
        type:"get",
        //async:false,
        //data:{},
        headers:{
            "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
        },         
        success:function(res){
            console.log("Publisher::Reads::countReadmeTotal try to retrive readta count.", res)
            if(res && res.rows==0){//无法回直接忽略
                //do nothing
            }else{//如果大于0则更新到页面
                if(res.data[0].totalCount>0){
                    var oldTxt = $("#readta").text();
                    $("#readta").text(oldTxt+"("+res.data[0].totalCount+")")
                }
            }
        }
    }); 
}

//根据openid查询阅读我的文章总数
function countReadmeByOpenid(openid){
    $.ajax({
        url:app.config.analyze_api+"?query=select count(eventId) as totalCount from ilife.reads where publisherOpenid='"+userInfo._key+"' and readerOpenid='"+openid+"' format JSON",
        type:"get",
        //async:false,
        //data:{},
        headers:{
            "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
        },         
        success:function(res){
            console.log("Publisher::Reads::countReadmeByOpenid try to retrive readme count by openid.", res)
            if(res && res.rows==0){//无法回直接忽略
                //do nothing
            }else{//否则更新readmeMap
                readmeMap[openid] = res.data[0].totalCount;
                checkReadsDiff(openid);//检查更新差异
            }
        }
    }); 
}

//根据openid查询我阅读的文章总数
function countReadtaByOpenid(openid){
    $.ajax({
        url:app.config.analyze_api+"?query=select count(eventId) as totalCount from ilife.reads where publisherOpenid='"+openid+"' and readerOpenid='"+userInfo._key+"' format JSON",
        type:"get",
        //async:false,
        //data:{},
        headers:{
            "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
        },         
        success:function(res){
            console.log("Publisher::Reads::countReadtaByOpenid try to retrive readta count by openid.", res)
            if(res && res.rows==0){//无法回直接忽略
                //do nothing
            }else{//否则更新readmeMap
                readtaMap[openid] = res.data[0].totalCount;
                checkReadsDiff(openid);//检查更新差异
            }
        }
    }); 
}

//检查阅我及阅TA差异，显示标签及按钮
function checkReadsDiff(openid){
    var diff = 0;
    if(readtaMap[openid] && readmeMap[openid]){
        diff = readtaMap[openid] - readmeMap[openid];
    }
    console.log("got read diffs.",diff)
    if(readmeMap[openid]&&readmeMap[openid]>0){
        $("#reader-readme-"+openid).text("阅我 "+readmeMap[openid]);
    }else{
        $("#reader-readme-"+openid).text("阅我 0");
    }
    if(readtaMap[openid]&&readtaMap[openid]>0){
        $("#reader-readta-"+openid).text("阅TA "+readtaMap[openid]);
    }else{
        $("#reader-readta-"+openid).text("阅TA 0");
    } 
    if(diff<0){
        $("#reader-btn-"+openid).text("去看TA");
        $("#reader-btn-"+openid).removeClass("action-tag-grey");
        $("#reader-btn-"+openid).addClass("action-tag");        
    }else{
        $("#reader-btn-"+openid).text("去看TA");
        $("#reader-btn-"+openid).removeClass("action-tag");
        $("#reader-btn-"+openid).addClass("action-tag-grey");
    }
}

//将item显示到页面
function insertItem(){
    // 加载内容
    var item = items[num-1];
    if(!item){
        shownomore(true);
        return;
    }  

    //默认随机指定logo
    //logo = "https://www.biglistoflittlethings.com/list/images/logo"+getRandomInt(23)+".jpeg";
    logo = "https://www.biglistoflittlethings.com/list/images/avatar/default.jpg";
    if(item.avatarUrl && item.avatarUrl!="undefined"){
        logo = item.avatarUrl;
    }

    var tagReadme = "<span id='reader-readme-"+item.openid+"' class='highlight-tag'></span>";
    var tagReadta = "<span id='reader-readta-"+item.openid+"' class='highlight-tag'></span>";
    var tagReadBtn = "<span id='reader-btn-"+item.openid+"' class='action-tag'></span>";

    var reader = "<div class='title readerDiv'><div class='readerName'>"+item.nickname+"</div><div class='readtaBtn'>"+ tagReadBtn+"</div></div>";
    var title = "<div class='description'>"+item.articleTitle+"</div>";
    var image = "<img src='"+logo+"' style='width:60px;object-fit:cover;border-radius:50%;'/>";
    var description = "<div class='description readerCountDiv'><div class='readTimestamp'>"+item.ts+"</div><div class='readCount'>"+tagReadme+tagReadta+"</div></div>";

    var seperator = "";
    if(num>1)
        seperator = "<div class='item-separator' style='border-radius:0'></div>";
    $("#waterfall").append("<li>"+seperator+"<div class='task' data='"+item.eventId+"' data-reader='"+item.openid+"'><div class='task-logo'>" + image +"</div><div class='task-tags'>" +reader +description + title+"</div></li>");
    num++;

    //查询当前用户对我的阅读数，检查完成后更新到对应条目
    if(!readmeMap[item.openid]){
        countReadmeByOpenid(item.openid);
    }

    //查询我对当前用户的阅读数，检查完成后更新到对应条目
    if(!readtaMap[item.openid]){
        countReadtaByOpenid(item.openid);
    }   

    //注册事件:点击整个条目跳转
    $("div[data='"+item.eventId+"']").click(function(){
        //跳转到reader的文章列表，根据readerOpenid过滤
        console.log("Publisher::Reads now jump to reader's article list.");  
        //window.location.href = "articles.html?byOpenid="+$(this).attr("data-reader");          
        window.location.href = "articles.html?byPublisherOpenid="+$(this).attr("data-reader");  
    });

    //注册事件:点击 去看TA 按钮跳转
    $("#reader-btn-"+item.openid).click(function(){
        //跳转到reader的文章列表，根据readerOpenid过滤
        console.log("Publisher::Reads now jump to reader's article list.");  
        //window.location.href = "articles.html?byOpenid="+$(this).attr("id").replace(/reader-btn-/,"");     
        window.location.href = "articles.html?byPublisherOpenid="+$(this).attr("id").replace(/reader-btn-/,"");        
    });


    // 表示加载结束
    loading = false;
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

/**
function insertBroker(broker){
    $("#brokerHint").html("流量主");
}
//**/

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

    var btns = "<div class='btns'><div id='article-"+item.id+"' data-id='"+item.id+"'>前往批阅</div></div>";

    $("#createArtileEntry").after("<li><div class='task' data='"+item.id+"' data-title='"+item.title+"' data-url='"+item.url+"'><div class='task-logo'>" + image +"</div><div class='task-tags'>" +title +description+"</div></li>");

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

