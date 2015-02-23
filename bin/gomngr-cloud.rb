#!/usr/bin/env ruby

##############################################################################
# Environment Configuration
##############################################################################
ONE_LOCATION=ENV["ONE_LOCATION"]

if !ONE_LOCATION
    RUBY_LIB_LOCATION="/usr/lib/one/ruby"
else
    RUBY_LIB_LOCATION=ONE_LOCATION+"/lib/ruby"
end

$: << RUBY_LIB_LOCATION

##############################################################################
# Required libraries
##############################################################################
require 'opennebula'

include OpenNebula

require 'optparse'
require 'mail'

Mail.defaults do
  delivery_method :smtp, address: "genogrid"
end

def sendEmail(msgsubject,msg,dest)
    if dest.nil?
      return
    end
    Mail.deliver do
      from     'genocloud-do-not-reply@genouest.org'
      to       dest
      subject  msgsubject
      body     msg
end

end

options = {}
OptionParser.new do |opts|
  opts.banner = "Usage: gomngr-cloud.rb [options]"

  options[:user] = nil
  opts.on("-u", "--user USER", "User id") do |u|
    options[:user] = u
  end
  options[:password] = nil
  opts.on("-p", "--password PASSWORD", "User password") do |p|
    options[:password] = p
  end
  opts.on("-c", "--create", "Create genocloud account") do |c|
    options[:create] = true
  end
  opts.on("-d", "--delete", "Delete genocloud account") do |d|
    options[:delete] = true
  end
  opts.on("-a", "--auth AUTH", "Oneadmin authentication user:password") do |a|
    options[:auth] = a
  end
  options[:email] = nil
  opts.on("-e", "--email EMAIL", "Send an email with result") do |e|
    options[:email] = e
  end
end.parse!


# OpenNebula credentials
CREDENTIALS = options[:auth]
# XML_RPC endpoint where OpenNebula is listening
ENDPOINT    = "http://genokvm4:2633/RPC2"

client = Client.new(CREDENTIALS, ENDPOINT)

err = nil

if options[:create]
  puts "Create user account: "+options[:user]
  user_pool = UserPool.new(client)
  user_pool.info
  user_pool.each do |user|
      user.info()
      if user.name == options[:user]
          msg = "User "+options[:user]+" already exists"
          sendEmail('Genocloud create '+options[:user], msg, options[:email])
          exit -1
      end
  end
  xml = User.build_xml
  user = User.new(xml, client)
  myuser = user.allocate(options[:user], options[:password], OpenNebula::User::CORE_AUTH)
  sendEmail('Genocloud create '+options[:user], 'Account created', options[:email])
end
if options[:delete]
  puts "Delete user account and VMs: "+options[:user]

  myuser = nil
  user_pool = UserPool.new(client)
  user_pool.info
  user_pool.each do |user|
      user.info()
      if user.name == options[:user]
          myuser = user
      end
  end
  if myuser.nil?
     msg = "User "+options[:user]+" not found"
     sendEmail('Genocloud delete '+options[:user], msg, options[:email])
     exit -1
  end

  user_vm_pool = VirtualMachinePool.new(client, myuser.id)

  user_vm_pool.info
  msg = "Account deleted with VMs:\n"
  user_vm_pool.each do |vm|
    vm.info
    msg += vm.name.to_s+"\n"
    #vm.delete
  end
  #myuser.delete
  sendEmail('Genocloud delete '+options[:user], msg, options[:email])
end


exit 0
