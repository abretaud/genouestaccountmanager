import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export class Plugin {
    name: string
    url: string
    display_name: string
    admin: boolean = false

    constructor(name, url, display, admin) {
        this.name = name
        this.url = url
        this.display_name = display
        this.admin = admin
    }
}

@Injectable({
    providedIn: 'root'
})
export class PluginService {

    constructor(private http: HttpClient, private authService: AuthService) { }

    list(): Observable<Plugin[]> {
        let user = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': user.apikey
            //}),
        };

        return this.http.get(environment.apiUrl + '/plugin', httpOptions)
            .pipe(map((response: any) => {
                return response.map(item => {
                    return new Plugin(
                        item.name,
                        item.url,
                        item.display_name,
                        item.admin
                    );
                });
            }));
    }

    dateConvert = function timeConverter(tsp){
        var a = new Date(tsp);
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        var year = a.getFullYear();
        var month = months[a.getMonth()];
        var date = a.getDate();
        var hour = a.getHours();
        var min = a.getMinutes();
        var sec = a.getSeconds();
        var time = date + ',' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
        return time;
    }

    get(pluginName: string, user: string) {
        let suser = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': suser.apikey
            //}),
        };

        return this.http.get(environment.apiUrl + '/plugin/' + pluginName + '/' + user, httpOptions)
    }

    set(pluginName: string, user: string, data: any) {
        let suser = this.authService.profile;
        let httpOptions = {
            //headers: new HttpHeaders({
            //  'x-api-key': suser.apikey
            //}),
        };

        return this.http.post(environment.apiUrl + '/plugin/' + pluginName + '/' + user, data, httpOptions)
    }
}
