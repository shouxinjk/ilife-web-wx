var client = "web";
// 文档加载完毕后执行
$(document).ready(function ()
{
    //根据屏幕大小判定是移动端还是桌面
    const oHtml = document.getElementsByTagName('html')[0]
    const width = oHtml.clientWidth;
    if(width<800){
       client = "wap";
    }
    var args = getQuery();//获取参数
    var code = args["s"]?args["s"]:0;//s为短码

    checkShortCode(code);
});

//记录分享用户、分享达人
var from = "mp";//链接来源，默认为公众号进入
var fromUser = "";
var fromBroker = "";

//根据短码查询URL地址信息，包括itemKey、fromBroker、fromUser
function checkShortCode(code){//获取详细内容
    $.ajax({
        url:app.config.analyze_api+"?query=select itemKey,channel,fromBroker,fromUser,longUrl,shortCode from ilife.urls where shortCode='"+shortCode+"' limit 1 format JSON",
        type:"get",
        //async:false,//同步调用
        data:{},
        headers:{
            "Authorization":"Basic ZGVmYXVsdDohQG1AbjA1"
        },  
        success:function(json){
            console.log("===got long url info===\n",json);
            from = json&&json.channel?json.channel:"mp";//可能为groupmessage,timeline等
            fromUser = json&&json.fromUser?json.fromUser:"";//从连接中获取分享用户ID
            fromBroker = json&&json.fromBroker?json.fromBroker:"";//从连接中获取分享达人ID。重要：将依据此进行收益计算

            //如果未指定fromBroker，则检查首次触达达人
            if(!fromBroker || fromBroker=="" || fromBroker.trim().length==0){
                fromBroker = util.getInitBroker();
            }

            if(json&&json.itemKey){
                jump(json.itemKey);  
            }else{//跳转到首页
                window.location.href = "index.html";
            }
        }
    });  
}

function jump(itemKey){//获取详细内容
    $.ajax({
        url:"https://data.shouxinjk.net/_db/sea/my/stuff/"+itemKey,
        type:"get",
        data:{},
        success:function(item){
            //先记录日志
            logstash(item,from,"buy step2",fromUser,fromBroker,function(){});
            //获取达人链接并跳转
            if(item.link.cps && item.link.cps[fromBroker] ){//能够直接获得达人链接则直接显示
                window.location.href = item.link.cps[fromBroker];
            }else{//否则请求其链接并显示
                getBrokerCpsLink(fromBroker,item);
            }            
        }
    })            
}


//根据Broker查询得到CPS链接
function getBrokerCpsLink(brokerId,item) {
    var data={
        brokerId:brokerId,
        source:item.source,
        category:"",//注意：不按照类别进行区分
        //category:item.categoryId?item.categoryId:"",
        url:item.link.wap
    };
    console.log("try to generate broker specified url",data);
    util.AJAX(app.config.sx_api+"/mod/cpsLinkScheme/rest/cpslink", function (res) {
        console.log("======\nload cps link info.",data,res);
        if (res.status) {//用返回的cps链接
            //更新到item，更新完成后跳转到cps链接地址
            //updateBrokerCpsLink(item,brokerId,res.link);
            //直接跳转            
            window.location.href = res.link;
        }else{//如果不能生成链接则直接使用已有链接
            if(item.link.wap2){
                window.location.href = item.link.wap2;
            }else if(item.link.wap){
                window.location.href = item.link.wap;
            }else{//理论上不会到这里
                window.location.href = item.url;
            }
        }
    },"GET",data);
}

//更新item信息：补充达人CPS链接
function updateBrokerCpsLink(item,brokerId,cpsLink) {
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    };   
    var cps = {};
    cps[brokerId]=cpsLink;//yibrokerId为key，以cpslink为value
    var data = {link:{cps:cps}};
    var url = app.config.data_api +"/_api/document/my_stuff/"+item._key;
    if (app.globalData.isDebug) console.log("Info2::updateItem update item with broker cps link.[itemKey]"+item._key,data);
    $.ajax({
        url:url,
        type:"PATCH",
        data:JSON.stringify(data),//注意：nginx启用CORS配置后不能直接通过JSON对象传值
        headers:header,
        timeout:2000,//设置超时
        success:function(res){//正确返回则跳转到返回地址
          if (app.globalData.isDebug) console.log("Info2::updateItem update item finished.", res);
          //跳转到cps地址
          window.location.href = cpsLink;
        },
        complete: function (XMLHttpRequest, textStatus) {//调用执行后调用的函数
            if(textStatus == 'timeout'){//如果是超时，则直接跳转到cps地址，忽略更新stuff失败
              console.log("ajax timeout. jump to cps link directly.",textStatus);
              window.location.href = cpsLink;
            }
        },
        error: function () {//调用出错执行的函数
            console.log("error occured while update cps link to stuff. jump to cps link directly.");
            window.location.href = cpsLink;
          }

    });
}


