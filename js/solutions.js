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
    loadUserProps(); //加载用户属性定义列表，用于提供动态表单

    //注册切换：清单、个性化定制
    $("#mySolutionFilter").click(function(e){
        window.location.href = "solutions.html";
    });
    $("#myBoardFilter").click(function(e){
        window.location.href = "boards.html";
    });

    //注册事件：切换操作类型
    $(".order-cell").click(function(e){
        changeActionType(e);
    });

    //加载个性化定制主题
    loadProposalSchemes();

    //注册事件：点击后开始创建新的solution
    $("#btnPublish").click(function(){
      //createSolution();
        if("guide"==proposalSchemeType){//如果是指南类型则显示表单
            //显示数据填报表单
            $.blockUI({ message: $('#jsonformDiv'),
                css:{ 
                    padding:        10, 
                    margin:         0, 
                    width:          '60%', 
                    top:            '20%', 
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
            //生成并显示表单
            generateJsonForm();
        }else{
            createSolution();
        }  

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
var proposalSchemeType = null; //方案类型

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

//对于guide类型方案，需要根据用户属性显示表单
var props = [];
function loadUserProps(){
    //获取所有用户属性
    $.ajax({
        url: app.config.sx_api+"/mod/userMeasure/rest/measures",
        type:"get",
        data:{},
        success:function(res){
            console.log("\n===got user measures ===\n",res);
            //遍历模板
            props = res;
            if(scripts && scripts.trim().length>0){
                checkScriptFields();
            }
        }
    });             
}
//生成用户动态表单
var formSchemeTpl = {
        schema:{},
        form:[],
        value:{}//默认value为空
};
var formTabTpl = { //构建tab
        "title":"",
        "type":"tab",
        "items":[]
      };
var formScheme = {};
var formValues = {};//表单值，默认采用默认值填写
var formFields = {};//记录动态表单的属性列表，kv对，key为属性property，v为组织后的的字段条目
var formTabs = {};//记录动态表单的tab下属性列表,每一个tab一个kv对。key为tab名称，及属性类目名称，value为其下包含的filed列表
function generateJsonForm(){
    formFields = {};//清空字段
    formValues = {};//清空表单值
    formTabs = {};//清空tabs
    formScheme = JSON.parse(JSON.stringify(formSchemeTpl));
    
    checkScriptFields();//先检查脚本中引用的字段
    
    //遍历属性组织formScheme
    var enumTypes = ["string","array"];//支持预先生成候选项
    props.forEach(function(prop){
        if(scriptFields==null || scriptFields.length==0 || scriptFields.indexOf(prop.property)>-1){//有引用时加入
            //表单字段
            var formItem ={
                    type: prop.type,
                    title: prop.name
                };
            if(prop.tags && prop.tags.trim().length>0 && enumTypes.indexOf(prop.type)>-1){ //仅对字符类提供选项
                formItem["enum"] = prop.tags.split(" ");
            }
            //array列表装载:当前默认为string类型多选
            if("array"==prop.type){
                formItem.type = "string";//默认为string类型
                formItem = { //增加array结构
                    type: prop.type, //直接为array
                    title: prop.name,
                    items : formItem
                };
            }            
            formFields[prop.property]=formItem;
            //value项
            if(prop.defaultValue && prop.defaultValue.trim().length>0){
                formValues[prop.property]=prop.defaultValue;
            }
            //tab项
            if(!formTabs[prop.category.name]){
                formTabs[prop.category.name] = [];
            }            
            formTabs[prop.category.name].push({
                key: prop.property,
                type: prop.field,
                activeClass: "btn-success"//default
            });             

        }else{//否则不加入
            //do nothing
        }
    });
    
    //组织得到formScheme
    formScheme.schema = formFields;
    
    //组织tabs
    var tabItems = [];
    Object.keys(formTabs).forEach(function(tabTitle){
        var tabItem = JSON.parse(JSON.stringify(formTabTpl));
        tabItem.title = tabTitle;
        tabItem.items = formTabs[tabTitle];
        tabItems.push(tabItem);
    });
    
    var tabScheme = {
            "type": "fieldset",
            "title": "为更好生成方案，请补充以下内容",
            "items": [{
                "type": "tabs",
                "id": "navtabs",
                "items": tabItems
            }]
        };
    formScheme.form.push(tabScheme);
    
    //组织提交按钮
    var btnScheme = {
            "type": "actions",
            "items": [{
                "type": "submit",
                "value": "生成个性化方案"
            }]
        };
    formScheme.form.push(btnScheme);

    //合并默认值及userInfo，以userInfo为主
    formValues = { ...formValues, ...app.globalData.userInfo };
    
    //将值设置进入form scheme
    formScheme.value = formValues;   //默认值        
    
    //设置提交事件
    formScheme.onSubmit = function (errors, values) {//jsonform 提交函数
                      values = {...app.globalData.userInfo, ...values};//合并userInfo一并提交
                      console.log("try submit json form.",errors,values);
                        //清空结果显示
                      if (errors) {
                        console.log("got erros.",errors);
                        siiimpleToast.message('提交表单出错',{
                            position: 'bottom|center'
                          }); 
                      }else {
                        var data = {
                              forOpenid:app.globalData.userInfo._key,
                              byOpenid:app.globalData.userInfo._key,
                              byNickname:app.globalData.userInfo.nickname,
                              forNickname:app.globalData.userInfo.nickname,
                              userInfo: values
                            }
                        console.log("try to submit data.",data);
                        //TODO 需要同步提交到arangodb保存最新用户数据
                        //根据表单数据生成个性化方案
                        $.ajax({
                            url: app.config.sx_api+"/diy/solution/rest/blank/"+categoryId,
                            type:"post",
                            data:JSON.stringify(data),
                            headers:{
                                "Content-Type":"application/json"
                            },  
                            timeout:5000,//设置超时                
                            success:function(ret){
                                console.log("create guide solution success.",ret);
                                if(!ret.success ){//创建失败
                                  siiimpleToast.message('糟糕，出错了~~',{
                                    position: 'bottom|center'
                                  }); 
                                }else{
                                    //直接跳转到编辑页面等待完善
                                    window.location.href="solution.html?id="+ret.solution.id;
                                }
                                
                            },
                            error: function () {//调用出错执行的函数
                                //请求出错处理：超时则直接显示搜索更多按钮
                                  siiimpleToast.message('糟糕，出错了~~',{
                                    position: 'bottom|center'
                                  }); 
                              }
                        });                         
                        //////表单提交结束
                      }
                    };

    console.log("form scheme.\n",JSON.stringify(formScheme),"\n",formScheme);
    
    //可以显示表单了
    $("#jsonform").empty();//清空原来的表单
    $("#jsonform").jsonForm(formScheme);

    //修正css风格
    $("div[id^=navtabs-]").css("text-align","left");
    $("#jsonform>div>fieldset").css("margin-top","0");
    $("#jsonform>div>fieldset>legend").css({
        "font-size":"14px",
        "padding-bottom":"5px"
    });
    $("li>a[href^='#navtabs-']").css({"font-size":"12px"}); //tab文字大小
    $("#jsonform>div>fieldset>div").css({//字段标题
        "font-size":"12px"
    });    
    $("#jsonform>div>fieldset>div .form-control").css({ 
        "font-size":"12px"
    });   
    $("#jsonform>div>fieldset>div label.btn>span").css({ //按钮形式数值文字大小
        "font-size":"12px"
    }); 
    $("#jsonform>div>fieldset>div .btn-default").css({ //按钮形式边框颜色
        "border-color":"#ccc"
    });            
    $("#jsonform>div>div").prepend('<span type="submit" class="btnNo" id="btnCancelJsonForm" style="font-size: 12px;padding:2px 5px;">取消</span>');
    $("#btnCancelJsonForm").click(function(e){ //绑定事件
        $.unblockUI(); 
    }); 
    //修改提交按钮风格
    $("#jsonform>div>div>input").addClass("btnYes").css({
        "margin-left":"5px",
        "font-size":"12px",
        "padding":"2px 5px",
        "margin-top":"-3px"
    });


}

//根据schemeId获取所有脚本，便于过滤需要显示的条目
//根据openid查询加载broker
var scripts = "";
function getSchemeScripts(schemeId) {
    util.AJAX(app.config.sx_api+"/diy/proposalScheme/rest/script/"+schemeId, function (res) {
        scripts = res.scripts;
        if(props&&props.length>0){
            checkScriptFields();
        }
    });
}

//检查脚本内容中是否包含有属性字段，如果没有属性字段则显示完整表单，否则显示包含的指定字段集
var scriptFields = [];//脚本中包含的字段列表，记录property值
function checkScriptFields(){
    scriptFields = [];//清空先
    console.log("try check scripts.",scripts);
    props.forEach(function(prop){
        const re = new RegExp(prop.property, 'g');
        if(scripts.match(re) && scriptFields.indexOf(prop.property)<0){ //仅放入一次
            scriptFields.push(prop.property);
        }
    });     
    console.log("fields in script.",scriptFields);
}

//根据当前选中schemeId创建一个空白solution并且跳转到编辑界面，等待完善
function createSolution(){
    $.ajax({
        url:app.config.sx_api+"/diy/solution/rest/blank/"+proposalSchemeId,
        type:"post",
        data:JSON.stringify({
          forOpenid:app.globalData.userInfo._key,
          byOpenid:app.globalData.userInfo._key,
          byNickname:app.globalData.userInfo.nickname,
          forNickname:app.globalData.userInfo.nickname 
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
                    //根据类型显示不同的标签：board普通显示，free绿色，guide红色
                    var styleCss = "border:1px solid #2a61f1;color:#2a61f1;";
                    var color = "#2a61f1";
                    if(proposalScheme.type == "guide"){
                        styleCss = "border:1px solid darkred;color:darkred;";
                        color = "darkred";
                    }else if(proposalScheme.type == "free"){
                        styleCss = "border:1px solid darkgreen;color:darkgreen;";
                        color = "darkgreen";
                    }                    
                    //同步写入主题选择Div
                    var proposalTag = "<div id='proposal"+proposalScheme.id+"' data-id='"+proposalScheme.id+"' data-type='"+proposalScheme.type+"' data-color='"+color+"' data-name='"+proposalScheme.name+"' style='line-height:20px;font-size:12px;min-width:60px;font-weight:bold;padding:2px 10px;border-radius:20px;margin:2px;"+styleCss+"'>"+proposalScheme.name+"</div>"
                    $("#proposalSchemesDiv").append( proposalTag );//同步写入候选表单  
                    //注册事件
                    $("#proposal"+proposalScheme.id).click(function(){
                        console.log("proposal scheme changed. ",  $(this).data("id") );

                        proposalSchemeId = $(this).data("id"); //设置全局变量，避免interval延迟调用问题
                        proposalSchemeType = $(this).data("type"); //设置全局变量，避免interval延迟调用问题

                        //高亮
                        $("div[id^=proposal]").each(function(){
                            $(this).css({
                                "background-color":"#fff",
                                "color":$(this).data("color")
                            });
                        });
                        $("#proposal"+proposalSchemeId).css({
                                "background-color":$("#proposal"+proposalSchemeId).data("color"),
                                "color":"#fff"
                            });       
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

    var imgWidth = 60;//固定为100
    var imgHeight = 60;//随机指定初始值
    //计算图片高度
    var imgSrc = "https://www.biglistoflittlethings.com/static/logo/distributor/ilife.png";
    if(item.scheme && item.scheme.logo && item.scheme.logo.trim().length>0)
      imgSrc = item.scheme.logo;
    var img = new Image();
    img.src = imgSrc;
    var orgWidth = img.width;
    var orgHeight = img.height;
    imgHeight = orgHeight/orgWidth*imgWidth;
    //计算文字高度：按照1倍行距计算

    var image = "<img src='"+imgSrc+"' width='"+imgWidth+"' height='"+imgHeight+"'/>"

    var title = "<div class='fav-item-title'>"+item.name+"</div>";
    var author = "<div  class='author' style='font-size:12px;font-weight:bold;color:darkorange;margin:2px 0;'>"+(item.byNickname?item.byNickname:"小确幸")+"</div>";
    
    //tag区分是自由定制还是专家指南 
    var tags = "<div style='display:flex;'>";
    if(item.scheme&&item.scheme.type=="guide"){
        tags += "<span style='border-radius:10px;background-color:darkred;color:#fff;padding:2px 5px;margin-right:2px;font-size:10px;line-height:12px;'>专家指南</span>";      
    }else if(item.scheme&&item.scheme.type=="free"){
        tags += "<span style='border-radius:10px;background-color:darkgreen;color:#fff;padding:2px 5px;margin-right:2px;font-size:10px;line-height:12px;'>个性定制</span>";      
    }else{
        //do nothing
    }
    //将scheme的category作为标签
    if(item.scheme && item.scheme.category && item.scheme.category.trim().length>0){
        item.scheme.category.split(" ").forEach(function(categoryTag){
            if(categoryTag.trim().length>0)
                tags += "<span style='border-radius:10px;background-color:#514c49;color:#fff;padding:2px 5px;margin-right:2px;font-size:10px;line-height:12px;'>"+categoryTag+"</span>";      
        });
    }    
    
    tags += "</div>";       
    var description = "<div class='fav-item-title' style='width:92%;font-weight:normal;font-size:12px;line-height: 14px;overflow: hidden; text-overflow: ellipsis;display: -webkit-box;-webkit-line-clamp: 4;-webkit-box-orient: vertical;'>"+item.description+"</div>";
    $("#waterfall").append("<li><div class='feed-separator' style='border-radius:0'></div><div class='fav-item' id='"+item.id+"'  style='margin:5px 0;'><div class='fav-item-logo'>" + image +"</div><div class='fav-item-tags' style='vertical-align:middle;'>" +title + author +tags + description+ "</div></li>");
 


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
        //insertPerson(userInfo);
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
            //insertBroker(res.data);//显示达人信息
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

