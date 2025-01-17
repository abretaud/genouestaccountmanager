import { Component, OnInit } from '@angular/core';
import { Website, WebsiteService } from 'src/app/user/website.service';
import { UserService } from 'src/app/user/user.service';

import { Subject } from 'rxjs';

@Component({
    selector: 'app-websites',
    templateUrl: './websites.component.html',
    styleUrls: ['./websites.component.css']
})
export class WebsitesComponent implements OnInit {

    dtTrigger: Subject<any> = new Subject()

    msg: string
    chowner_msg: string
    chowner_err_msg: string
    websites: Website[]
    website: Website
    users: any

    owner_web_name: any
    owner_web_owner: any

    constructor(
        private websitesService: WebsiteService,
        private userService: UserService
    ) { }

    ngOnDestroy(): void {
        this.dtTrigger.unsubscribe();
    }

    ngOnInit() {
        this.userService.list().subscribe(
            resp => this.users = resp,
            err => this.msg = err.error
        )
        this.websitesService.list().subscribe(
            resp => {this.websites = resp; this.dtTrigger.next();},
            err => this.msg = err.error
        )
    }

    change_owner() {
        if(!this.owner_web_name || !this.owner_web_owner){
            this.chowner_err_msg = 'No web or owner selected';
            return;
        }
        this.websitesService.changeOwner(this.owner_web_name.name, this.owner_web_name.owner, this.owner_web_owner.uid).subscribe(
            resp => this.chowner_msg = resp['message'],
            err => this.chowner_err_msg = err.error
        )
    }

}
