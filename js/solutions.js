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
        width: width-20,
        delay: 100,
    });
    $("body").css("background-color","#fff");//更改body背景为白色

    loadPerson(currentPerson);//加载用户
    //loadData();//加载数据：默认使用当前用户查询

    //注册事件：切换操作类型
    $(".order-cell").click(function(e){
        changeActionType(e);
    });

    //加载个性化定制主题
    loadProposalSchemes();

    //注册事件：点击后开始创建新的solution
    $("#btnPublish").click(function(){
      createSolution();
    }) 
    //取消充值
    $("#btnCancel").click(function(e){
        $.unblockUI(); 
    }); 
    //注册事件：点击开始创建按钮
    $("#createSolutionBtn").click(function(){
        //显示数据填报表单
        $.blockUI({ message: $('#chooseSchemeForm'),
            css:{ 
                padding:        10, 
                margin:         0, 
                width:          '80%', 
                top:            '30%', 
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


});

util.getUserInfo();//从本地加载cookie

var loading = false;
var dist = 50;
var num = 1;//需要加载的内容下标

var items = [];
var page = {//翻页控制
  size: 20,//每页条数
  total: 1,//总页数
  current: -1//当前翻页
};

var currentActionType = '';//当前操作类型
var tagging = '';//操作对应的action 如buy view like 等

var currentPerson = app.globalData.userInfo?app.globalData.userInfo._key:null;
var userInfo=app.globalData.userInfo;//默认为当前用户

var proposalSchemeId = null;

setInterval(function ()
{
    //console.log("interval",$(window).scrollTop(),$(document).height(),$(window).height(),$(document).height() - $(window).height() - dist);
    if ($(window).scrollTop() >= $(document).height() - $(window).height() - dist && !loading)
    {
        // 表示开始加载
        loading = true;

        // 加载内容
        if(items.length < num){//如果内容未获取到本地则继续获取
            //console.log("load from remote ");
            loadData();
        }else{//否则使用本地内容填充
            //console.log("load from locale ");
            insertItem();
        }
    }
}, 60);


//根据当前选中schemeId创建一个空白solution并且跳转到编辑界面，等待完善
function createSolution(){
    $.ajax({
        url:app.config.sx_api+"/diy/solution/rest/blank/"+proposalSchemeId,
        type:"post",
        data:JSON.stringify({
          forOpenid:app.globalData.userInfo._key,
          byOpenid:app.globalData.userInfo._key
        }),
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },
        timeout:3000,//设置超时
        success:function(ret){
            console.log("create blank solution success.",ret);
            if(!ret.success ){//创建失败
              siiimpleToast.message('糟糕，出错了~~',{
                position: 'bottom|center'
              }); 
            }else{
                //直接跳转到编辑页面等待完善
                window.location.href="solution-modify.html?id="+ret.solution.id;
            }
        },
        error: function () {//调用出错执行的函数
            //请求出错处理：超时则直接显示搜索更多按钮
              siiimpleToast.message('糟糕，出错了~~',{
                position: 'bottom|center'
              }); 
          }
    });  
}

//搜索得到定制主题
function loadProposalSchemes() {
    console.log("try load proposal scheme.");
    //直接查询全部
    $.ajax({
        url:app.config.sx_api+"/diy/proposalScheme/rest/byName/*",
        type:"get",
        data:{name:"*"},
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },
        success:function(data){
            console.log("Feed::loadData success.",data);
            if(data.length == 0){//如果没有内容，则显示提示文字
                $("#categoryDiv").append("<div style='font-size:12px;'>没有匹配的定制方案，请重新尝试</div>");
            }else{
                //显示到界面
                data.forEach(function(proposalScheme){
                    console.log("got item. ",proposalScheme);
                    //同步写入主题选择Div
                    var proposalTag = "<div id='proposal"+proposalScheme.id+"' data-id='"+proposalScheme.id+"' data-name='"+proposalScheme.name+"' style='line-height:20px;font-size:12px;min-width:60px;font-weight:bold;padding:2px 10px;border:1px solid silver;border-radius:20px;margin:2px;'>"+proposalScheme.name+"</div>"
                    $("#proposalSchemesDiv").append( proposalTag );//同步写入候选表单  
                    //注册事件
                    $("#proposal"+proposalScheme.id).click(function(){
                        console.log("proposal scheme changed. ",  $(this).data("id") );

                        proposalSchemeId = $(this).data("id"); //设置全局变量，避免interval延迟调用问题
                        //高亮
                        $("div[id^=proposal]").css("background-color","#fff");
                        $("div[id^=proposal]").css("color","#000");          
                        $("#proposal"+proposalSchemeId).css("background-color","2a61f1");
                        $("#proposal"+proposalSchemeId).css("color","#fff");        
                    });                              
                });
            }
        }
    });
  }


//根据选定的定制主题查询所有方案
function loadData() {
    console.log("Feed::loadData");
    var query = { //默认查询所有
          byOpenid: app.globalData.userInfo._key,
          page:{
            pageNo: page.current,
            pageSize: page.size
          }
        };
    $.ajax({
        url:app.config.sx_api+"/diy/solution/rest/search",
        type:"post",
        data:JSON.stringify(query),
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },
        timeout:3000,//设置超时
        success:function(ret){
            console.log("Feed::loadData success.",ret);
            if(!ret.success || !ret.data || ret.data.length==0){//如果没有内容，则显示提示文字
                shownomore(true);
                showloading(false);
            }else{
                //更新当前翻页
                page.current = page.current + 1;
                //装载具体条目
                for(var i = 0 ; i < ret.data.length ; i++){
                    items.push(ret.data[i]);
                }
                insertItem();
                showloading(false);
            }
        },
        complete: function (XMLHttpRequest, textStatus) {//调用执行后调用的函数
            if(textStatus == 'timeout'){//如果是超时，则显示更多按钮
              console.log("ajax超时",textStatus);
              shownomore(true);
            }
        },
        error: function () {//调用出错执行的函数
            //请求出错处理：超时则直接显示搜索更多按钮
            shownomore(true);
          }
    });
  }


//将item显示到页面
//所属类型、名称、创建时间
function insertItem(){
    // 加载内容
    var item = items[num-1];
    console.log("try insert item.",num,item,items);
    if(!item){
      shownomore(true);
      return;
    }
    //排重
    if($("#"+item.id).length>0)
      return;

    var imgWidth = 48;//固定为100
    var imgHeight = 48;//随机指定初始值
    //计算图片高度
    var imgSrc = "https://www.biglistoflittlethings.com/static/logo/distributor/ilife.png";
    if(item.scheme && item.scheme.logo && item.scheme.logo.trim().length()>0)
      imgSrc = item.scheme.logo;
    var img = new Image();
    img.src = imgSrc;
    var orgWidth = img.width;
    var orgHeight = img.height;
    imgHeight = orgHeight/orgWidth*imgWidth;
    //计算文字高度：按照1倍行距计算

    var image = "<img src='"+imgSrc+"' width='"+imgWidth+"' height='"+imgHeight+"'/>"

    var title = "<div class='fav-item-title'>"+item.name+"</div>";
    var description = "<div class='fav-item-title' style='width:92%;font-weight:normal;font-size:12px;line-height: 14px;overflow: hidden; text-overflow: ellipsis;display: -webkit-box;-webkit-line-clamp: 4;-webkit-box-orient: vertical;'>"+item.description+"</div>";
    $("#waterfall").append("<li><div class='feed-separator' style='border-radius:0'></div><div class='fav-item' id='"+item.id+"'><div class='fav-item-logo'>" + image +"</div><div class='fav-item-tags' style='vertical-align:middle;'>" +title + description+ "</div></li>");
 


    num++;

    //注册事件：跳转到方案查看界面
    $("#"+item.id).click(function(){
        window.location.href = "solution.html?id="+item.id;
    });

    // 表示加载结束
    loading = false;
}

//load related persons
function loadPerson(personId) {
    console.log("try to load person info.",personId);
    util.AJAX(app.config.data_api+"/user/users/"+personId, function (res) {
        console.log("load person info.",personId,res);
        userInfo = res;
        currentPerson = res._key;
        insertPerson(userInfo);
        loadData();
        loadBrokerByOpenid(res._key);//根据openid加载broker信息
    });
}

//根据openid查询加载broker
function loadBrokerByOpenid(openid) {
    console.log("try to load broker info by openid.[openid]",openid);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/brokerByOpenid/"+openid, function (res) {
        console.log("load broker info.",openid,res);
        if (res.status) {
            insertBroker(res.data);//显示达人信息
        }
    });
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

