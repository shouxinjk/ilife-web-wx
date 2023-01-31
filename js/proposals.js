// 文档加载完毕后执行
$(document).ready(function ()
{
        //根据屏幕大小计算字体大小
    const oHtml = document.getElementsByTagName('html')[0]
    width = oHtml.clientWidth;
    var rootFontSize = 12 * (width / 1440);// 在1440px的屏幕基准像素为12px
    rootFontSize = rootFontSize <8 ? 8:rootFontSize;//最小为8px
    rootFontSize = rootFontSize >16 ? 16:rootFontSize;//最大为18px
    oHtml.style.fontSize = rootFontSize+ "px";   
    //计算图片流宽度：根据屏幕宽度计算，最小显示2列
    /**
    if(width < 2*columnWidth){//如果屏幕不能并排2列，则调整图片宽度
        columnWidth = (width-columnMargin*4)/2;//由于每一个图片左右均留白，故2列有4个留白
    }    
    //**/
    //加载所有定制主题
    loadProposalSchemes();

    //显示加载状态
    showloading(true);
    //处理参数
    var args = getQuery();//获取参数
    //category = args["category"]?args["category"]:0; //如果是跳转，需要获取当前目录
    if(args["schemeId"])categoryId=args["schemeId"];//从请求中获取schemeId
    if(args["id"])inputPerson=args["id"];//从请求中获取需要展示的person或personaId
/**
    $('#waterfall').NewWaterfall({
        width: width-20,//1列
        //width: columnWidth,//动态列宽，当前为2列
        delay: 100,
    });
    //**/


    $("body").css("background-color","#fff");//更改body背景为白色

    util.getUserInfo();//从本地加载cookie
    loadBrokerInfo(); //从本地加载达人信息
    loadUserProps(); //加载用户属性定义列表，用于提供动态表单
    
    searchCategory();//默认发起类目检索
    loadFeeds();//默认查询所有方案

    //注册事件：点击搜索后重新查询meta category
    $("#findAll").click(function(){//注册搜索事件：点击搜索全部
        $("#categoryDiv").empty();
        searchCategory();  
        loadFeeds();//重新查询方案   
    });  

    //注册事件：点击后开始创建新的solution
    $("#btnPublish").click(function(){
      if(categoryId == "board"){//如果是board则直接创建
          console.log("try create board");
          createBoard();       
      }else if(categoryId && categoryId.trim().length>0){//如果已经选中了主题则直接创建
            if("guide"==categoryType){//如果是指南类型则显示表单
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
      }else{
        console.log("unkonw type. ignore.");
      }      
    }) 
    //取消充值
    $("#btnCancel").click(function(e){
        $.unblockUI(); 
    });      

    //注册事件：点击开始创建按钮
    $("#createProposalBtn").click(function(){
      if(categoryId == "board"){//如果是board则直接创建
          console.log("try create board");
          createBoard();       
      }else if(categoryId && categoryId.trim().length>0){//如果已经选中了主题则直接创建
            if("guide"==categoryType){//如果是指南类型则显示表单
                //显示数据填报表单
                $.blockUI({ message: $('#jsonformDiv'),
                    css:{ 
                        padding:        10, 
                        margin:         0, 
                        width:          '89%', 
                        top:            '20%', 
                        left:           '5%', 
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
      }else{//否则需要选择主题
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
      }
    });  

    //注册事件：显示定制提示
    $("#showCustomizeInfoBtn").click(function(){
        //显示表单
        $.blockUI({ message: $('#customizeform'),
            css:{ 
                padding:        10, 
                margin:         0, 
                width:          '80%', 
                top:            '20%', 
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

    //注册事件：隐藏排行规则
    $(".btnNo").click(function(){     
        $.unblockUI(); //直接取消即可
    });

    //注册分享事件
    registerShareHandler();   

});

var width = 600;
var clientWidth = 600;

//以下记录proposalScheme。由于与board混合，采用类目进行识别
var categoryId = null; //记录当前切换的metaCategory。由于启用定时器，切换时有延迟，导致加载的是上一个category商品的情况
var categoryName = ""; //作为推荐搜索关键字，切换类目后用类目名称填写
var categoryType = ""; //记录scheme类型，guide 或 free

var columnWidth = 300;//默认宽度300px
var columnMargin = 5;//默认留白5px

var loading = false;
var dist = 500;
var num = 1;//需要加载的内容下标

var items = [];
var page = {//翻页控制
  size: 20,//每页条数
  total: 1,//总页数
  current: -1//当前翻页
};

var persons = [];
var currentPerson = app.globalData.userInfo?app.globalData.userInfo._key:JSON.parse($.cookie('sxUserInfo'))._key;//本地加载当前用户
var currentPersonTagging = "";//记录当前用户的标签清单，用于根据标签显示内容
var currentPersonType = "person";//当前选中的是用户还是画像，默认进入时显示当前用户
var personKeys = [];//标记已经加载的用户key，用于排重

var inputPerson = null;//接收指定的personId或personaId

//获取所有定制主题列表，显示方案时根据主题得到具体类型。
//fix：索引里所有定制方案类型均为solution，需要根据scheme判断是free还是guide
var proposalSchemes = [];
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
            if(data)proposalSchemes=data;
        }
    });
  }

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
        url:app.config.sx_api+"/diy/solution/rest/blank/"+categoryId,
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
        timeout:5000,//设置超时
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

//创建一个空白board并且跳转到首页，等待添加内容
function createBoard(){
    var header={
        "Content-Type":"application/json"
    };     
    var authorName = app.globalData.userInfo && app.globalData.userInfo.nickName ?app.globalData.userInfo.nickName:"小确幸";
    var data = {
        broker:{
            id:broker&&broker.id?broker.id:"system"
        },
        byOpenid: app.globalData.userInfo._key,
        byNickname: app.globalData.userInfo.nickName,
        logo:"https://www.biglistoflittlethings.com/static/logo/distributor/ilife.png",
        poster:JSON.stringify({}),
        article:JSON.stringify({}),          
        title:authorName?authorName+" 的推荐清单":"新推荐清单",
        description:"根据你的需求，我们精心挑选了以下清单，请查收",
        tags:"",
        keywords:""
    };
    util.AJAX(app.config.sx_api+"/mod/board/rest/board", function (res) {
        console.log("Broker::Board::AddBoard create board successfully.", res)
        if(res.status){
            console.log("Broker::Board::AddBoard now jump to home page for item adding.", res)
            /**
            var expDate = new Date();
            expDate.setTime(expDate.getTime() + (15 * 60 * 1000)); // 15分钟后自动失效：避免用户不主动修改            
            $.cookie('board', JSON.stringify(res.data), { expires: expDate, path: '/' });  //把编辑中的board写入cookie便于添加item
            //**/
            //提示已创建
            siiimpleToast.message('清单已创建，请添加条目~~',{
                  position: 'bottom|center'
                });    
            //前往首页
            setTimeout(function(){
              window.location.href = "index.html?boardId="+res.data.id;
            },1000);            
        }
    }, "POST",data,header);
}

//优先从cookie加载达人信息
var broker = {
  id:"77276df7ae5c4058b3dfee29f43a3d3b",//默认设为Judy达人
  nickname:"小确幸大生活"
}
function loadBrokerInfo(){
  broker = util.getBrokerInfo();//先设置为本地信息
  loadBrokerByOpenid(app.globalData.userInfo._key);//重新加载
}
//load person
function loadPerson(personId) {
    console.log("try to load person info.",personId);
    util.AJAX(app.config.data_api+"/user/users/"+personId, function (res) {
        console.log("load person info.",personId,res);
        syncPerson(res);//提交用户昵称到后端
        //loadBrokerByOpenid(res._key);//根据openid加载broker信息
    });
}
//同步用户信息：将用户昵称及头像同步到后台
function syncPerson(person){
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

//根据openid查询加载broker
function loadBrokerByOpenid(openid) {
    util.AJAX(app.config.sx_api+"/mod/broker/rest/brokerByOpenid/"+openid, function (res) {
        if (res.status) {//将佣金信息显示到页面
            broker = res.data;          
        }
    });
}

var sxInterval = null;
function loadFeeds(){
    //先清空原来的
    resetItemsInterval();
    sxInterval = setInterval(function ()
    {
        //console.log("interval",$(window).scrollTop(),$(document).height(),$(window).height(),$(document).height() - $(window).height() - dist);
        if ($(window).scrollTop() >= $(document).height() - $(window).height() - dist && !loading)
        {
            // 表示开始加载
            loading = true;

            // 加载内容
            if(items.length < num){//如果内容未获取到本地则继续获取
                console.log("try load data.");
                loadData();
            }else{//否则使用本地内容填充
                //console.log("load from locale ");
                insertItem();
            }
        }
    }, 60);
}


//搜索得到metaCategory
var keyword = "*";
function searchCategory() {
    console.log("Measures::searchCategory",$("#searchTxt").val());
    if($("#searchTxt").val() && $("#searchTxt").val().trim().length>0)
      keyword = $("#searchTxt").val().trim();
    //直接查询
    $.ajax({
        url:app.config.sx_api+"/diy/proposalScheme/rest/byName/"+keyword,
        type:"get",
        data:{name:keyword},
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },
        timeout:5000,//设置超时
        success:function(data){
            console.log("Feed::loadData success.",data);
            if(data.length == 0){//如果没有内容，则显示提示文字
                //$("#categoryDiv").append("<div style='font-size:12px;'>没有匹配的定制方案，请重新尝试</div>");
                shownomore(true);
                showloading(false);
            }else{//显示到界面
                //先显示board
                insertCategoryItem({
                  id:"board",
                  name:"主题组合清单"
                });  
                //然后逐个显示
                data.forEach(function(item){
                    console.log("got item. ",item);
                    insertCategoryItem(item);                  
                });
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

//清空缓存的商品列表、定时器及DOM元素，在切换目录时均需要调用
function resetItemsInterval(){
    //清空商品及定时器
    if(!sxInterval){
      clearInterval(sxInterval);
      sxInterval = null;
    }        
    //恢复当前分页并清空列表
    num = 1;
    page.current = -1;
    items = [];
    dist = 500;
    loading = false;
    $("#Center").empty();
    $("#Center").append('<ul id="waterfall"></ul>');
    $('#waterfall').NewWaterfall({
        width: width-20,//1列
        //width: columnWidth,//动态列宽，当前为2列
        delay: 100,
    });  
}


//根据选定的定制主题查询所有方案
var complexQueryTpl = JSON.stringify({//搜索控制
  from: (page.current + 1) * page.size,
  size: page.size,
  query: {
    bool: {
      must: [],
      should: []
    }
  },    
  sort: [
    { "timestamp": { order: "desc" } },//最近操作的优先显示
    { "_score": { order: "desc" } }//匹配高的优先显示
  ]
});

//设置query
function loadData() {
    console.log("Feed::loadData",categoryId);
    //默认查询：查询所有
    var esQuery={
        from:(page.current + 1) * page.size,
        size:page.size,
        query: {
            match_all: {}
        },
        sort: [
            { "timestamp": { order: "desc" }},
            { "_score":   { order: "desc" }}
        ]
    };

    //复杂查询：根据类型及scheme查询
    var complexQuery = {//搜索控制
                          from: (page.current + 1) * page.size,
                          size: page.size,
                          query: {
                            bool: {
                              must: [],
                              should: []
                            }
                          },    
                          sort: [
                            { "timestamp": { order: "desc" } },//最近操作的优先显示
                            { "_score": { order: "desc" } }//匹配高的优先显示
                          ]
                        };
    //如果有关键词则根据关键词过滤，否则匹配全部
    if(keyword && keyword.trim().length>1 && keyword!="*"){
      complexQuery.query.bool.should.push({
          match:{
            full_text:keyword
          }
        });        
    }

    //如果选定了类目则过滤
    if(categoryId && categoryId.trim().length>0){
      if(categoryId=="board"){
        complexQuery.query.bool.must.push({ //查询所有清单
            match:{
              type:"board"
            }
          }); 
      }else{
        complexQuery.query.bool.must.push({ //类型指定为solution
            match:{
              type:"solution"
            }
          }); 
        complexQuery.query.bool.must.push({ //且根据scheme过滤
            match:{
              scheme:categoryId
            }
          });         
      } 
    }

    //设置请求头
    var esHeader = {
      "Content-Type": "application/json",
      "Authorization": "Basic ZWxhc3RpYzpjaGFuZ2VtZQ=="
    };
    var q = JSON.stringify(categoryId||(keyword&&keyword.trim().length>1)?complexQuery:esQuery);
    console.log("try search.",q);
    $.ajax({
        url:"https://data.pcitech.cn/proposal/_search",
        type:"post",
        data:q,//根据是否有输入选择查询
        headers:esHeader,
        crossDomain: true,
        timeout:5000,//设置超时
        success:function(data){
            console.log("Feed::loadData success.",data);
            if(data.hits.total == 0 || data.hits.hits.length==0){//如果没有内容，则显示提示文字
                shownomore(true);
                showloading(false);
            }else{
                //更新总页数
                var total = data.hits.total;
                page.total = (total + page.size - 1) / page.size;
                //更新当前翻页
                page.current = page.current + 1;
                //装载具体条目
                var hits = data.hits.hits;
                for(var i = 0 ; i < hits.length ; i++){
                    items.push(hits[i]._source);
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
    if($("#"+item.itemkey).length>0)
      return;

    var imgWidth = 60;//固定为100
    var imgHeight = 60;//随机指定初始值
    //计算图片高度
    var imgSrc = item.logo.replace(/\.avif/g,"");
    var img = new Image();
    img.src = imgSrc;
    var orgWidth = img.width;
    var orgHeight = img.height;
    imgHeight = orgHeight/orgWidth*imgWidth;
    //计算文字高度：按照1倍行距计算

    var image = "<img src='"+imgSrc+"' width='"+imgWidth+"' height='"+imgHeight+"'/>"

    var title = "<div class='fav-item-title'>"+item.name+"</div>";
    var author = "<div  class='author' style='font-size:12px;font-weight:bold;color:darkorange;margin:2px 0;'>"+item.author+"</div>";
    var tags = "<div style='display:flex;'>";
    //如果是board，默认第一个添加 主题组合清单标签
    if(item.type=="board"){
        tags += "<span style='border-radius:10px;background-color:#226cff;color:#fff;padding:2px 5px;margin-right:2px;font-size:10px;line-height:12px;'>主题组合清单</span>";      
    }else if(item.type=="solution"){ //如果是定制主题，则需要根据scheme判断具体类型
        var proposalScheme = proposalSchemes.find(proposalScheme => proposalScheme.id == item.scheme);
        if(proposalScheme && proposalScheme.type =="guide"){
            tags += "<span style='border-radius:10px;background-color:#CC3333;color:#fff;padding:2px 5px;margin-right:2px;font-size:10px;line-height:12px;'>专家指南</span>";      
        }else if(proposalScheme && proposalScheme.type =="free"){
            tags += "<span style='border-radius:10px;background-color:#009933;color:#fff;padding:2px 5px;margin-right:2px;font-size:10px;line-height:12px;'>定制师方案</span>";      
        }
        //将scheme的category作为标签
        if(proposalScheme && proposalScheme.category && proposalScheme.category.trim().length>0){
            proposalScheme.category.split(" ").forEach(function(categoryTag){
                if(categoryTag.trim().length>0)
                    tags += "<span style='border-radius:10px;background-color:#514c49;color:#fff;padding:2px 5px;margin-right:2px;font-size:10px;line-height:12px;'>"+categoryTag+"</span>";      
            });
        }
    }

    if(item.tags && item.tags.length>0){//装载标签
        item.tags.forEach(function(tag){
            if(tag&&tag.trim().length>0)
                tags += "<span style='border-radius:10px;background-color:#514c49;color:#fff;padding:2px 5px;margin-right:2px;font-size:10px;line-height:12px;'>"+tag+"</span>";
        });
    }
    tags += "</div>";    
    var description = "<div class='fav-item-title' style='width:92%;margin-top:2px;font-weight:normal;font-size:12px;line-height: 14px;overflow: hidden; text-overflow: ellipsis;display: -webkit-box;-webkit-line-clamp: 4;-webkit-box-orient: vertical;'>"+item.description+"</div>";
    $("#waterfall").append("<li><div class='feed-separator' style='border-radius:0'></div><div class='fav-item' id='"+item.itemkey+"' data-type='"+item.type+"' style='margin:5px 0;'><div class='fav-item-logo'>" + image +"</div><div class='fav-item-tags' style='vertical-align:middle;'>" +title + author +tags+ description+ "</div></li>");

    num++;

    //注册事件：跳转到方案查看界面
    $("#"+item.itemkey).click(function(){
        var type = $(this).data("type");
        if(type=="solution"){
          window.location.href = "solution.html?id="+item.itemkey;
        }else if(type=="board"){
          window.location.href = "board2-waterfall.html?id="+item.itemkey;
        }else{
          console.log("unknown type.",type);
        }
        
    });

    // 表示加载结束
    loading = false;
}


//显示没有更多内容
function shownomore(flag){
  //检查是否是一条数据都没加载
  if(items.length==0){//需要特别处理：如果没有任何数据，则需要默认设置，否则导致无法显示show more btn
    $("#waterfall").height(10);
    $("#no-results-tip").toggleClass("no-result-tip-hide",false);
    $("#no-results-tip").toggleClass("no-result-tip-show",true);
  }    
  if(flag){
    $("#findMoreBtn").toggleClass("findMoreBtn-hide",false);
    $("#findMoreBtn").toggleClass("findMoreBtn-show",true);
    //注册跳转事件：跳转到推荐页，需要带有当前用户ID
    $("#findMoreBtn").click(function(){
      window.location.href = "index.html?keyword="+categoryName;
    });    
  }else{
    $("#findMoreBtn").toggleClass("findMoreBtn-hide",true);
    $("#findMoreBtn").toggleClass("findMoreBtn-show",false);
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

//将item显示到页面
var shareTitle = "确幸定制·你的专属个性化方案";
var shareLogo = "https://www.biglistoflittlethings.com/ilife-web-wx/images/proposal.jpeg";
function insertCategoryItem(proposalScheme){
    if(!proposalScheme){
      shownomore(true);
      return;
    }
    //隐藏no-more-tips
    $("#no-results-tip").toggleClass("no-result-tip-hide",true);
    $("#no-results-tip").toggleClass("no-result-tip-show",false); 

    //根据类型显示不同的标签：board普通显示，free绿色，guide红色
    var styleCss = "border:1px solid #226cff;color:#226cff;";
    var color = "#226cff";
    if(proposalScheme.type == "guide"){
        styleCss = "border:1px solid #CC3333;color:#CC3333;";
        color = "#CC3333";
    }else if(proposalScheme.type == "free"){
        styleCss = "border:1px solid #009933;color:#009933;";
        color = "#009933";
    }

    var measureTag = "<div id='metacat"+proposalScheme.id+"' data-id='"+proposalScheme.id+"' data-type='"+proposalScheme.type+"' data-color='"+color+"' data-name='"+proposalScheme.name+"' style='line-height:16px;font-size:12px;min-width:60px;font-weight:bold;padding:2px;border-radius:10px;margin:2px;"+styleCss+"'>"+proposalScheme.name+"</div>"
    $("#categoryDiv").append( measureTag );

    //注册事件
    $("#metacat"+proposalScheme.id).click(function(){
        console.log("meta category changed. ",  $(this).data("id") );

        categoryId = $(this).data("id"); //设置全局变量，避免interval延迟调用问题
        categoryName = $(this).data("name"); //设置全局变量，避免interval延迟调用问题
        categoryType = $(this).data("type"); //设置全局变量，避免interval延迟调用问题

        //注意：以下代码不work。原因：微信分享在页面实例化之后完成注册，后续参数变化不会引起分享内容变化。调整为随机设置
        //修改分享标题
        if(categoryType == "free"){
            shareTitle = "定制师方案·"+categoryName;
            shareLogo = "https://www.biglistoflittlethings.com/ilife-web-wx/images/icon/type-solution.png";
        }else if(categoryType == "guide"){
            shareTitle = "专家指南·"+categoryName;
            shareLogo = "https://www.biglistoflittlethings.com/ilife-web-wx/images/icon/type-guide.png";
        }else if(categoryId == "board"){
            shareTitle = "甄选合集·"+categoryName;
            shareLogo = "https://www.biglistoflittlethings.com/ilife-web-wx/images/icon/type-board.png";
        }

        //重新注册分享事件
        registerShareHandler();

        //修改新建标题
        $("#createProposalTip").html("定制我的 "+categoryName);

        //如果是个性化指南guide则加载scripts
        if("guide"==categoryType){
            getSchemeScripts(categoryId);
        }

        loadFeeds();//加载该主题下的具体方案列表

        //高亮
        $("div[id^=metacat]").each(function(){
            $(this).css({
                "background-color":"#fff",
                "color":$(this).data("color")
            });
        });
        $("#metacat"+categoryId).css({
                "background-color":$("#metacat"+categoryId).data("color"),
                "color":"#fff"
            });
  
    });

    //根据类型显示不同的标签：board普通显示，free绿色，guide红色
    var styleCss = "border:1px solid #226cff;color:#226cff;";
    var color = "#226cff";
    if(proposalScheme.type == "guide"){
        styleCss = "border:1px solid #CC3333;color:#CC3333;";
        color = "#CC3333";
    }else if(proposalScheme.type == "free"){
        styleCss = "border:1px solid #009933;color:#009933;";
        color = "#009933";
    }

    //同步写入主题选择Div
    var proposalTag = "<div id='proposal"+proposalScheme.id+"' data-id='"+proposalScheme.id+"' data-type='"+proposalScheme.type+"' data-color='"+color+"' data-name='"+proposalScheme.name+"' style='line-height:20px;font-size:12px;min-width:60px;font-weight:bold;padding:2px 10px;border-radius:20px;margin:2px;"+styleCss+"'>"+proposalScheme.name+"</div>"
    $("#proposalSchemesDiv").append( proposalTag );//同步写入候选表单
    //注册事件
    $("#proposal"+proposalScheme.id).click(function(){
        console.log("meta category changed. ",  $(this).data("id") );

        categoryId = $(this).data("id"); //设置全局变量，避免interval延迟调用问题
        categoryName = $(this).data("name"); //设置全局变量，避免interval延迟调用问题
        categoryType = $(this).data("type"); //设置全局变量，避免interval延迟调用问题

        //如果是个性化指南guide则加载scripts
        if("guide"==categoryType){
            getSchemeScripts(categoryId);
        }
 
        //高亮
        $("div[id^=proposal]").each(function(){
            $(this).css({
                "background-color":"#fff",
                "color":$(this).data("color")
            });
        });
        $("#proposal"+categoryId).css({
                "background-color":$("#proposal"+categoryId).data("color"),
                "color":"#fff"
            });            
    });

    // 表示加载结束
    showloading(false);
    loading = false;    
}

//更新item信息。只用于更新profit
function updateItem(item) {
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    };  
    var url = app.config.data_api +"/_api/document/my_stuff/"+item._key;
    if (app.globalData.isDebug) console.log("Feeds::updateItem update item.",item);
    util.AJAX(url, function (res) {
      if (app.globalData.isDebug) console.log("Feeds::updateItem update item finished.", res);
      //do nothing
    }, "PATCH", item, header);
}

function changePerson (type,personId,personTagging) {
    var ids = personId;
    if (app.globalData.isDebug) console.log("Feed::ChangePerson change person.",currentPerson,personId);
    $("#"+currentPerson+" img").removeClass("person-img-selected");
    $("#"+currentPerson+" img").addClass("person-img");
    $("#"+ids+" img").removeClass("person-img");
    $("#"+ids+" img").addClass("person-img-selected");

    $("#"+currentPerson+" span").removeClass("person-name-selected");
    $("#"+currentPerson+" span").addClass("person-name");
    $("#"+ids+" span").removeClass("person-name");
    $("#"+ids+" span").addClass("person-name-selected");

    $("#waterfall").empty();//清空原有列表
    $("#waterfall").css("height","20px");//调整瀑布流高度
    showloading(true);//显示加载状态

    page.current = -1;//从第一页开始查看
    currentPerson = ids;//修改当前用户
    currentPersonTagging = personTagging;//修改当前用户推荐Tagging
    currentPersonType = type;//更改当前用户类型
    items = [];//清空列表
    num = 1;//从第一条开始加载
    //loadData();//重新加载数据
  } 

// 自动加载更多：此处用于测试，动态调整图片高度
function random(min, max)
{
    return min + Math.floor(Math.random() * (max - min + 1))
}

// 时间戳转多少分钟之前
function getDateDiff(dateTimeStamp) {
    // 时间字符串转时间戳
    var timestamp = new Date(dateTimeStamp).getTime();
    var minute = 1000 * 60;
    var hour = minute * 60;
    var day = hour * 24;
    var halfamonth = day * 15;
    var month = day * 30;
    var year = day * 365;
    var now = new Date().getTime();
    var diffValue = now - timestamp;
    var result;
    if (diffValue < 0) {
        return;
    }
    var yearC = diffValue / year;
    var monthC = diffValue / month;
    var weekC = diffValue / (7 * day);
    var dayC = diffValue / day;
    var hourC = diffValue / hour;
    var minC = diffValue / minute;
    if (yearC >= 1) {
        result = "" + parseInt(yearC) + "年前";
    } else if (monthC >= 1) {
        result = "" + parseInt(monthC) + "月前";
    } else if (weekC >= 1) {
        result = "" + parseInt(weekC) + "周前";
    } else if (dayC >= 1) {
        result = "" + parseInt(dayC) + "天前";
    } else if (hourC >= 1) {
        result = "" + parseInt(hourC) + "小时前";
    } else if (minC >= 1) {
        result = "" + parseInt(minC) + "分钟前";
    } else
        result = "刚刚";
    return result;
}

//注册分享事件后参数变化无效，采用随机显示方式
var shareTitlePrefixs = ["确幸定制·","定制师方案·","专家指南·","甄选合集·"];
var shareLogos = [
"https://www.biglistoflittlethings.com/ilife-web-wx/images/proposal.jpeg",
"https://www.biglistoflittlethings.com/ilife-web-wx/images/icon/type-solution.png",
"https://www.biglistoflittlethings.com/ilife-web-wx/images/icon/type-guide.png",
"https://www.biglistoflittlethings.com/ilife-web-wx/images/icon/type-board.png"];
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
    if(app.globalData.userInfo && app.globalData.userInfo._key){//如果为注册用户，则使用当前用户
        shareUserId = app.globalData.userInfo._key;
    }

    //准备分享url，需要增加分享的 fromUser、fromBroker信息
    var shareUrl = window.location.href.replace(/proposals/g,"share");//需要使用中间页进行跳转
    if(shareUrl.indexOf("?")>0){//如果本身带有参数，则加入到尾部
        shareUrl += "&fromUser="+shareUserId;
        shareUrl += "&fromBroker="+shareBrokerId;
    }else{//否则作为第一个参数增加
        shareUrl += "?fromUser="+shareUserId;
        shareUrl += "&fromBroker="+shareBrokerId;        
    }
    shareUrl += "&origin=proposals";//添加源，表示是一个列表页分享
    //添加categoryId及categoryName
    if(categoryId && categoryId.trim().length>0){
        shareUrl += "&categoryId="+categoryId;  
    }
    if(categoryName && categoryName.trim().length>0){
        shareUrl += "&categoryName="+categoryName;  
    }

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
                //随机获取分享标题前缀及图片
                var idx = Math.floor(Math.random()*1000)%4;
                //分享到朋友圈
                wx.updateTimelineShareData({
                    title:shareTitlePrefixs[idx]+(categoryName?categoryName:"个性化专属"), // 分享标题
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl:shareLogos[idx], // 分享图标
                    success: function () {
                        // 用户点击了分享后执行的回调函数
                        //TODO: solution分享当前不记录
                        /*
                        logstash(stuff,"mp","share timeline",shareUserId,shareBrokerId,function(res){
                            console.log("分享到朋友圈",res);
                        }); 
                        //**/
                    },
                });
                //分享给朋友
                wx.updateAppMessageShareData({
                    title:shareTitlePrefixs[idx]+(categoryName?categoryName:"个性化专属"), // 分享标题
                    desc:"专家指南+定制师经验，无论是个性体检，还是旅游行程，都能快速获取专属方案。", // 分享描述
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl: shareLogos[idx], // 分享图标
                    type: 'link', // 分享类型,music、video或link，不填默认为link
                    dataUrl: '', // 如果type是music或video，则要提供数据链接，默认为空
                    success: function () {
                      // 用户点击了分享后执行的回调函数
                      //TODO:solution分享当前不记录
                      /**
                        logstash(stuff,"mp","share appmsg",shareUserId,shareBrokerId,function(res){
                            console.log("分享到微信",res);
                        }); 
                        //**/
                    }
                });  

                //分享到朋友圈
                wx.onMenuShareTimeline({
                    title:shareTitlePrefixs[idx]+(categoryName?categoryName:"个性化专属"), // 分享标题
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl:shareLogos[idx], // 分享图标
                    success: function () {
                        // 用户点击了分享后执行的回调函数
                        //TODO: solution分享当前不记录
                        /*
                        logstash(stuff,"mp","share timeline",shareUserId,shareBrokerId,function(res){
                            console.log("分享到朋友圈",res);
                        }); 
                        //**/
                    },
                });
                //分享给朋友
                wx.onMenuShareAppMessage({
                    title:shareTitlePrefixs[idx]+(categoryName?categoryName:"个性化专属"), // 分享标题
                    desc:"专家指南+定制师经验，无论是个性体检，还是旅游行程，都能快速获取专属方案。", // 分享描述
                    //link:window.location.href, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
                    link:shareUrl,
                    imgUrl: shareLogos[idx], // 分享图标
                    type: 'link', // 分享类型,music、video或link，不填默认为link
                    dataUrl: '', // 如果type是music或video，则要提供数据链接，默认为空
                    success: function () {
                      // 用户点击了分享后执行的回调函数
                      //TODO:solution分享当前不记录
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
