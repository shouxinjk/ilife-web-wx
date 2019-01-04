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
    var id = args["id"]?args["id"]:0;
    jump(id);
});

function jump(id){//获取详细内容
    $.ajax({
        url:"https://data.shouxinjk.net/_db/sea/my/stuff/"+id,
        type:"get",
        data:{},
        success:function(item){
            logstash(item,client,"buy step2",function(){
                if(client == "wap"){
                    window.location.href=item.link.wap2?item.link.wap2:item.link.wap;
                }else{
                    window.location.href=item.link.web2?item.link.web2:item.link.web;
                }
                
            });
        }
    })            
}
